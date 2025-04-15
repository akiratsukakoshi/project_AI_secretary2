/**
 * MCP（Message Composition Protocol）コネクタの基底クラス
 * v2.0: 外部サービスとの連携をMCPサーバーを通じて行うためのベースクラス
 * v2.1: Claude CodeのMCPサポートを追加
 */

import { ServiceConnector, ServiceResponse } from '../../core/service-connector.interface';
import logger from '../../../../utilities/logger';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

// execFileを非同期で実行するためのPromise版
const execFileAsync = promisify(execFile);

/**
 * MCPコネクタの基底クラス
 */
export abstract class MCPConnectorBase implements ServiceConnector {
  // API接続モード用の設定
  protected baseUrl?: string;
  protected apiKey?: string;
  
  // Claude Code MCP用の設定
  protected useMCP: boolean;
  protected mcpConfigPath?: string;
  protected mcpServerConfig?: any;
  protected mcpServerName?: string;
  
  /**
   * コンストラクタ
   * @param baseUrl MCPサーバーのベースURL（API接続モードの場合）
   * @param apiKey 認証用APIキー（API接続モードの場合、オプション）
   * @param useMCP Claude CodeのMCPを使用するかどうか
   * @param mcpConfigPath MCPの設定ファイルパス（useMCPがtrueの場合）
   * @param mcpServerName MCP設定ファイル内のサーバー名（デフォルトはクラス名から派生）
   */
  constructor(
    baseUrl?: string, 
    apiKey?: string,
    useMCP: boolean = false,
    mcpConfigPath?: string,
    mcpServerName?: string
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.useMCP = useMCP;
    this.mcpConfigPath = mcpConfigPath;
    this.mcpServerName = mcpServerName || this.getDefaultMcpServerName();
    
    // MCPモードの場合は設定ファイルを読み込む
    if (this.useMCP && this.mcpConfigPath) {
      try {
        const configContent = fs.readFileSync(this.mcpConfigPath, 'utf8');
        this.mcpServerConfig = JSON.parse(configContent);
        
        if (!this.mcpServerConfig.mcpServers || !this.mcpServerConfig.mcpServers[this.mcpServerName]) {
          logger.warn(`MCP設定ファイル内に「${this.mcpServerName}」サーバーが見つかりません。API接続モードにフォールバックします。`);
          this.useMCP = false;
        } else {
          logger.info(`MCP設定ファイルを読み込みました。「${this.mcpServerName}」サーバーを使用します。`);
        }
      } catch (error) {
        logger.error(`MCP設定ファイルの読み込みに失敗しました: ${this.mcpConfigPath}`, error);
        logger.warn('API接続モードにフォールバックします。');
        this.useMCP = false;
      }
    } else if (this.useMCP) {
      logger.warn('MCP設定ファイルが指定されていないため、API接続モードにフォールバックします。');
      this.useMCP = false;
    }
    
    // API接続モードの場合はベースURLチェック
    if (!this.useMCP && !this.baseUrl) {
      logger.error('MCP API接続モードはベースURLが必要です。');
      throw new Error('MCP API接続モードにベースURLが指定されていません。');
    }
  }
  
  /**
   * デフォルトのMCPサーバー名を取得（クラス名から派生）
   */
  private getDefaultMcpServerName(): string {
    // クラス名からサーバー名を派生（例: GoogleCalendarMCPConnector → google-calendar）
    const className = this.constructor.name;
    const match = className.match(/^([A-Za-z]+)MCPConnector$/);
    
    if (match && match[1]) {
      // キャメルケースをケバブケースに変換 (例: GoogleCalendar → google-calendar)
      const serverName = match[1].replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      return serverName;
    }
    
    // デフォルトのサーバー名
    return 'mcp-server';
  }
  
  /**
   * MCPツールを実行する
   * @param tool ツール名
   * @param params パラメータ
   */
  async execute(tool: string, params: Record<string, any>): Promise<ServiceResponse> {
    // パラメータの環境変数参照を実際の値に置換
    const processedParams = this.processEnvironmentVariables(params);
    logger.debug(`環境変数置換後のパラメータ:`, processedParams);
    
    // APIモードを優先し、使用不可の場合はMCPモードにフォールバック
    if (this.baseUrl) {
      try {
        return await this.executeAPI(tool, processedParams);
      } catch (error: any) {
        logger.warn(`API接続に失敗しました。MCPモードにフォールバックします: ${error.message}`);
        if (this.useMCP) {
          return this.executeMCP(tool, processedParams);
        }
        throw error;
      }
    } else if (this.useMCP) {
      return this.executeMCP(tool, processedParams);
    } else {
      throw new Error('実行可能な接続方法がありません');
    }
  }
  
  /**
   * パラメータオブジェクト内の環境変数参照文字列を実際の値に置換する
   * 例: "${process.env.NOTION_TASK_DB_ID}" → 実際のデータベースID
   */
  private processEnvironmentVariables(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    // 文字列の場合は環境変数参照をチェック
    if (typeof obj === 'string') {
      // 文字列内の${process.env.XXX}パターンを検出して置換
      return obj.replace(/\${process\.env\.([A-Z_]+)}/g, (match, envVarName) => {
        const envValue = process.env[envVarName];
        if (envValue === undefined) {
          logger.warn(`環境変数 ${envVarName} が見つかりません`);
          return match; // 環境変数が見つからない場合は元の文字列を維持
        }
        logger.info(`環境変数 ${envVarName} を実際の値に置換しました`);
        return envValue;
      });
    }
    
    // 配列の場合は各要素を再帰的に処理
    if (Array.isArray(obj)) {
      return obj.map(item => this.processEnvironmentVariables(item));
    }
    
    // オブジェクトの場合はすべてのプロパティを再帰的に処理
    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = this.processEnvironmentVariables(obj[key]);
        }
      }
      return result;
    }
    
    // その他の型はそのまま返す
    return obj;
  }
  
  /**
   * Claude CodeのMCPを使用してツールを実行
   */
  private async executeMCP(tool: string, params: Record<string, any>): Promise<ServiceResponse> {
    let childProcess: any = null;
    try {
      logger.info(`Claude Code MCPツール実行: ${tool}、パラメータ:`, params);
      
      if (!this.mcpServerConfig || !this.mcpServerConfig.mcpServers || 
          !this.mcpServerName || !this.mcpServerConfig.mcpServers[this.mcpServerName]) {
        throw new Error(`MCP設定が見つかりません: ${this.mcpServerName}`);
      }
      
      const serverConfig = this.mcpServerConfig.mcpServers[this.mcpServerName || ''];
      
      // MCPサーバーコマンドとパラメータ
      const command = serverConfig.command;
      const args = [
        ...serverConfig.args,
        '--command', tool,
        '--args', JSON.stringify(params)
      ];
      
      // タイムアウト用の Promise
      const timeoutPromise = new Promise<{stdout: string, stderr: string}>((_, reject) => {
        const timeoutId = setTimeout(() => {
          // 子プロセスが存在する場合は強制終了
          if (childProcess && typeof childProcess.kill === 'function') {
            try {
              // SIGKILL で強制終了
              childProcess.kill('SIGKILL');
              logger.warn(`MCPプロセスをタイムアウトのため強制終了: ${command} ${args.join(' ')}`);
            } catch (killError) {
              logger.error(`MCPプロセス強制終了時にエラー:`, killError);
            }
          }
          reject(new Error(`ETIMEDOUT: MCPツール実行がタイムアウトしました (${tool})`));
        }, 30000); // 30秒のタイムアウト - Notionクエリに十分な時間を確保
        
        return () => clearTimeout(timeoutId);
      });
      
      // コマンド実行の Promise
      const execPromise = new Promise<{stdout: string, stderr: string}>((resolve, reject) => {
        try {
          logger.debug(`MCPコマンド実行: ${command} ${args.join(' ')}`);
          
          // 子プロセスを取得して保存（タイムアウト時に強制終了するため）
          childProcess = execFile(command, args, { encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error) {
              reject(error);
              return;
            }
            resolve({ stdout, stderr });
          });
          
          // エラーイベントリスナを追加
          childProcess.on('error', (error: Error) => {
            logger.error(`MCPプロセス実行エラー: ${error.message}`);
            reject(error);
          });
        } catch (error) {
          reject(error);
        }
      });
      
      // 両方のPromiseでレース
      const { stdout, stderr } = await Promise.race([execPromise, timeoutPromise]);
      
      if (stderr && stderr.trim() !== '') {
        logger.warn(`MCP stderr出力: ${stderr}`);
      }
      
      try {
        // 結果をJSONとしてパース
        const result = JSON.parse(stdout);
        logger.debug(`MCPツール実行結果:`, result);
        
        return {
          success: true,
          data: result
        };
      } catch (parseError: any) {
        logger.error(`MCPツール実行結果のJSONパースに失敗: ${stdout.substring(0, 100)}...`, parseError);
        return {
          success: false,
          error: `MCPツールの応答をパースできませんでした: ${parseError.message}`
        };
      }
    } catch (error) {
      // タイムアウトエラーを特別に処理
      if (error instanceof Error && error.message.includes('ETIMEDOUT')) {
        logger.error(`MCPツール実行がタイムアウトしました (${tool}):`, error);
        return {
          success: false,
          error: `MCPツール実行がタイムアウトしました: ${tool}。実行時間が長すぎるか、プロセスが応答していません。`
        };
      }
      
      logger.error(`MCPツール実行エラー (${tool}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MCPツール実行に失敗しました'
      };
    }
  }
  
  /**
   * API経由でMCPツールを実行
   */
  private async executeAPI(tool: string, params: Record<string, any>): Promise<ServiceResponse> {
    try {
      logger.info(`MCP APIツール実行: ${tool}、パラメータ:`, JSON.stringify(params));
      
      if (!this.baseUrl) {
        throw new Error('API接続のベースURLが指定されていません');
      }
      
      // MCPサーバーへのAPIリクエストを構築
      const url = `${this.baseUrl}/api/tools/${tool}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        logger.debug(`認証ヘッダーを設定: Bearer ${this.apiKey.substring(0, 5)}...`);
      } else {
        logger.warn(`認証ヘッダーなしでリクエストを実行します: ${url}`);
      }
      
      // リクエスト詳細をデバッグログに記録
      logger.debug(`APIリクエスト詳細:`, {
        url: url,
        method: 'POST',
        headers: Object.keys(headers).map(key => `${key}: ${key === 'Authorization' ? '***' : headers[key]}`),
        bodyLength: JSON.stringify(params).length
      });
      
      // APIリクエスト実行開始時間記録
      const startTime = Date.now();
      
      // APIリクエスト実行
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
      });
      
      // 応答時間の記録
      const responseTime = Date.now() - startTime;
      logger.debug(`APIレスポンス時間: ${responseTime}ms`);
      
      // レスポンスのハンドリング
      if (!response.ok) {
        // エラーレスポンス解析を試みる
        let errorText = '';
        let errorJson = null;
        
        try {
          // JSONとしてパースを試みる
          errorJson = await response.json();
          errorText = JSON.stringify(errorJson);
        } catch (jsonError) {
          // JSONとしてパースできない場合はテキストとして取得
          errorText = await response.text();
        }
        
        // 詳細なエラーログを記録
        logger.error(`MCP API エラー: ${response.status} ${errorText}`, {
          status: response.status,
          statusText: response.statusText,
          url: url,
          tool: tool,
          errorDetail: errorJson || errorText,
          headers: Object.fromEntries([...response.headers.entries()]),
          params: JSON.stringify(params).substring(0, 500),
          responseTime: responseTime
        });
        
        return {
          success: false,
          error: `MCPエラー (${response.status}): ${errorText}`,
          data: { error: errorJson }
        };
      }
      
      const data = await response.json();
      logger.debug(`MCPツール実行結果:`, JSON.stringify(data).length > 1000 ? 
                 `[データサイズ: ${JSON.stringify(data).length}文字]` : 
                 data);
      
      return {
        success: true,
        data
      };
    } catch (error: any) {
      // 詳細なエラー情報を取得
      const errorDetails = {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n'),
        cause: error.cause,
        code: error.code,
        url: this.baseUrl ? `${this.baseUrl}/api/tools/${tool}` : 'URL未設定',
        hasApiKey: !!this.apiKey,
        apiKeyLength: this.apiKey ? this.apiKey.length : 0,
        paramsSample: JSON.stringify(params).substring(0, 200) + '...'
      };
      
      logger.error(`MCP APIツール実行エラー (${tool}):`, errorDetails);
      
      // fetchエラーの詳細な処理
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return {
          success: false,
          error: `Notion APIサーバー接続エラー: ${error.message}。サーバーが起動しているか確認してください。`,
          data: { 
            error: {
              type: 'connection_error',
              originalError: error.message
            }
          }
        };
      }
      
      return {
        success: false,
        error: error.message || 'MCPツール実行に失敗しました',
        data: {
          error: {
            errorName: error.name,
            errorCode: error.code
          }
        }
      };
    }
  }
  
  /**
   * 利用可能なツール一覧を取得
   */
  async getAvailableTools(): Promise<Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>> {
    // MCPモードの場合はモック実装を提供
    // Claude Code MCPでは現在、利用可能なツール一覧を取得する標準的な方法がない
    if (this.useMCP) {
      return this.getMockAvailableTools();
    }
    
    // API接続モードではAPIからツール一覧を取得
    try {
      if (!this.baseUrl) {
        throw new Error('API接続のベースURLが指定されていません');
      }
      
      logger.info(`MCPサーバーから利用可能なツール一覧を取得: ${this.baseUrl}`);
      // ツール一覧取得のエンドポイントを呼び出し
      const url = `${this.baseUrl}/api/tools`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`ツール一覧取得エラー: ${response.status} ${errorText}`);
        return [];
      }
      
      const tools = await response.json();
      logger.debug(`利用可能なツール: ${tools.length}個`);
      
      return tools;
    } catch (error) {
      logger.error('ツール一覧取得エラー:', error);
      // エラー時は空の配列を返す
      return [];
    }
  }
  
  /**
   * 基本的なGoogle Calendarツールのモックを返す
   * Claude Code MCPでは動的なツール一覧取得ができないため、代替手段として静的なリストを提供
   */
  protected getMockAvailableTools(): Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }> {
    // サブクラスでオーバーライドするべき
    return [];
  }
  
  /**
   * ツール情報をキャッシュする
   * （将来的な拡張ポイント - パフォーマンス最適化用）
   */
  protected cacheTools(tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>): void {
    // 将来の実装のための準備
    // 現在は特に何もしない
  }
  
  /**
   * サービスの説明を取得 - サブクラスでオーバーライド
   */
  abstract getServiceDescription(): string;
}
