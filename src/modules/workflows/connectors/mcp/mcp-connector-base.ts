/**
 * MCP（Message Composition Protocol）コネクタの基底クラス
 * v2.0: 外部サービスとの連携をMCPサーバーを通じて行うためのベースクラス
 */

import { ServiceConnector, ServiceResponse } from '../../core/service-connector.interface';
import logger from '../../../../utilities/logger';

/**
 * MCPコネクタの基底クラス
 */
export abstract class MCPConnectorBase implements ServiceConnector {
  protected baseUrl: string;
  protected apiKey?: string;
  
  /**
   * コンストラクタ
   * @param baseUrl MCPサーバーのベースURL
   * @param apiKey 認証用APIキー（オプション）
   */
  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }
  
  /**
   * MCPツールを実行する
   * @param tool ツール名
   * @param params パラメータ
   */
  async execute(tool: string, params: Record<string, any>): Promise<ServiceResponse> {
    try {
      logger.info(`MCPツール実行: ${tool}、パラメータ:`, params);
      
      // MCPサーバーへのAPIリクエストを構築
      const url = `${this.baseUrl}/api/tools/${tool}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      
      // APIリクエスト実行
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
      });
      
      // レスポンスのハンドリング
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`MCP API エラー: ${response.status} ${errorText}`);
        
        return {
          success: false,
          error: `MCPエラー (${response.status}): ${errorText}`
        };
      }
      
      const data = await response.json();
      logger.debug(`MCPツール実行結果:`, data);
      
      return {
        success: true,
        data
      };
    } catch (error: any) {
      logger.error(`MCPツール実行エラー (${tool}):`, error);
      return {
        success: false,
        error: error.message || 'MCPツール実行に失敗しました'
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
    try {
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
