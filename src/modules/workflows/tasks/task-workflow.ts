/**
 * タスク管理ワークフロー
 * Notion MCPを使用したタスク管理機能
 */

import { WorkflowDefinition, WorkflowResult, WorkflowContext } from '../core/workflow-types';
import { NotionMCPConnector } from '../connectors/mcp/notion-mcp';
import { NameResolver } from './name-resolver';
import { reminderService } from './reminder-service';
import { taskPrompts } from '../prompts/task-prompts';
import { escapeTemplateVariables, deepEscapeTemplateVariables } from "../utilities/template-safety";
import { mapNotionResponseToTask, mapTaskToNotionRequest } from './task-model';
import logger from '../../../utilities/logger';

/**
 * エラーパターンに基づいて、ユーザーにわかりやすい提案メッセージを生成
 * @param pattern 検出された危険なパターン
 * @returns 提案メッセージ
 */
function getErrorSuggestion(pattern: string): string {
  // パターンに基づいた提案
  if (pattern.includes('taskDbId') || pattern.includes('TASK_DB_ID')) {
    return '変数名ではなく、直接IDの値を文字列として指定してください。例: "1d39a1dfe8368135941de579ca166c05"';
  }
  
  if (pattern.includes('staffDbId') || pattern.includes('STAFF_DB_ID')) {
    return 'スタッフデータベースIDには変数名ではなく直接IDの値を文字列として指定してください。';
  }
  
  if (pattern.includes('process.env')) {
    return '環境変数は直接参照せず、具体的な値を使用してください。';
  }
  
  if (pattern.includes('(') && pattern.includes(')')) {
    return '関数呼び出し形式は使用できません。文字列リテラルを使用してください。';
  }
  
  if (pattern.includes('${')) {
    return 'テンプレート文字列の変数展開は使用できません。通常の文字列リテラルを使用してください。';
  }
  
  if (pattern.includes('=>')) {
    return 'アロー関数は使用できません。文字列リテラルや数値リテラルのみを使用してください。';
  }
  
  // デフォルトの提案
  return '文字列や数値をそのまま値として使用し、変数や関数を参照しないでください。';
}

/**
 * 関数呼び出し形式のパターンを厳密にチェックする拡張深層検査
 * @param obj 任意のオブジェクト（LLMからの出力JSONなど）
 * @returns 検出された危険なパターンと場所、なければnull
 */
function deepScanForDangerousPatterns(obj: any): { pattern: string, path: string } | null {
  // 正規表現パターン群
  const patterns = [
    // 基本的な関数呼び出しパターン
    /\b(\w+)\s*\(\s*\)/,
    // 変数形式の関数呼び出しパターン
    /\$\{\s*(\w+)\s*\}/,
    // 文字列内の中括弧展開パターン
    /\$\{.*?\}/,
    // 他の危険な関数パターン（eval, new Function など）
    /\b(eval|Function|setTimeout|setInterval)\s*\(/,
    // 変数への関数的アクセス
    /\b(\w+)\[['"](\w+)['"]\]\s*\(/,
    // アロー関数定義
    /=>\s*{/,
    // テンプレートリテラルパターン
    /`.*?\${[\s\S]*?}`/
  ];

  /**
   * オブジェクトを再帰的にスキャンして関数呼び出しパターンを検出
   */
  function scan(value: any, path: string = ''): { pattern: string, path: string } | null {
    // nullやundefinedは無視
    if (value === null || value === undefined) {
      return null;
    }

    // 文字列の場合はパターン検証
    if (typeof value === 'string') {
      // コメント行に見えるパターンを除去した文字列を得る（安全対策）
      const commentFreeValue = value.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      
      for (const pattern of patterns) {
        const match = commentFreeValue.match(pattern);
        if (match) {
          // 危険なパターンを検出
          return {
            pattern: match[0],
            path: path
          };
        }
      }
      
      // 特定の危険なキーワード - 単語単位で評価
      const dangerousKeywords = ['taskDbId', 'staffDbId', 'process.env'];
      for (const keyword of dangerousKeywords) {
        // 単語境界で囲まれた完全なキーワードのみをマッチ
        const keywordRegex = new RegExp(`\\b${keyword}\\b`);
        if (keywordRegex.test(commentFreeValue)) {
          return {
            pattern: keyword,
            path: path
          };
        }
      }
    }
    
    // 配列の場合は各要素を再帰的にチェック
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const result = scan(value[i], `${path}[${i}]`);
        if (result) {
          return result;
        }
      }
    }
    
    // オブジェクトの場合は各プロパティを再帰的にチェック
    if (typeof value === 'object') {
      for (const key of Object.keys(value)) {
        const result = scan(value[key], path ? `${path}.${key}` : key);
        if (result) {
          return result;
        }
      }
    }
    
    return null;
  }
  
  return scan(obj);
}

/**
 * LLMレスポンスを安全にパースし、危険なパターンをチェックする
 * @param content LLMからの生のレスポンス文字列
 * @returns パースされた安全なオブジェクト
 * @throws 危険なパターンを検出したりパースエラーが発生した場合
 */
function safeParseAndValidate(content: string): any {
  // 関数呼び出しパターンをチェック（パース前の段階で）
  // コメント行やドキュメント内の説明文に含まれるパターンも検出
  const rawCheck = content.match(/\b\w+\s*\(\s*\)/g);
  if (rawCheck) {
    const found = rawCheck[0];
    const patternContext = content.substring(
      Math.max(0, content.indexOf(found) - 30), 
      Math.min(content.length, content.indexOf(found) + found.length + 30)
    );
    
    // 詳細情報を含むエラーログ
    logger.error(`LLMレスポンスに関数呼び出しパターンが見つかりました: ${found}`, {
      pattern: found,
      context: patternContext,
      responseLength: content.length,
      detectionPhase: 'パース前の文字列チェック'
    });
    
    throw new Error(`安全でないパターンが検出されました: ${found} - このような形式ではなく、文字列としてデータベースIDを指定してください`);
  }

  // JSON文字列をパース
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    logger.error('LLMレスポンスのJSONパースに失敗:', error);
    throw new Error(`JSONパースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
    // テンプレート変数構文のブロック - 安全対策を強化
    parsed = deepEscapeTemplateVariables(parsed);
    
    // テンプレート構文が含まれていないかログ確認
    logger.debug("テンプレート変数エスケープ後のパース結果:", { parsed });

  // 深層検査
  const dangerousPattern = deepScanForDangerousPatterns(parsed);
  if (dangerousPattern) {
    // JSONの抜粋を取得して文脈を追加
    const contentSample = JSON.stringify(parsed).substring(0, 200) + '...';
    
    // 詳細なエラーログ
    logger.error(`危険なパターンを検出: ${dangerousPattern.pattern} at ${dangerousPattern.path}`, {
      pattern: dangerousPattern.pattern,
      path: dangerousPattern.path,
      contentSample: contentSample,
      detectionPhase: 'JSONパース後の深層検査',
      objectType: typeof parsed,
      isArray: Array.isArray(parsed)
    });
    
    // ユーザーにわかりやすいメッセージを返す
    const suggestionMessage = getErrorSuggestion(dangerousPattern.pattern);
    throw new Error(`安全でないパターンを検出しました: ${dangerousPattern.pattern} at ${dangerousPattern.path}. ${suggestionMessage}`);
  }

  return parsed;
}

/**
 * パラメータを安全な値に変換する（すべての値を文字列化して関数参照を無効化）
 * @param params 元のパラメータオブジェクト
 * @returns 安全に変換されたパラメータ
 */
function sanitizeParameters(params: Record<string, any>): Record<string, any> {
  const safeParams: Record<string, any> = {};
  
  // データベースIDなどの既知の文字列値を直接置換
  const directReplacements: Record<string, string> = {
    'taskDbId': process.env.NOTION_TASK_DB_ID || '',
    'staffDbId': process.env.NOTION_STAFF_DB_ID || '',
    'TASK_DB_ID': process.env.NOTION_TASK_DB_ID || '',
    'STAFF_DB_ID': process.env.NOTION_STAFF_DB_ID || '',
  };
  
  // 文字列値を再帰的に変換する関数
  const convertValue = (value: any): any => {
    if (value === null || value === undefined) {
      // テンプレート文字列パターンをエスケープ - 追加の安全対策
      value = escapeTemplateVariables(value);

      return value;
    }
    
    // 文字列の場合、既知のパターンを置換
    if (typeof value === 'string') {
      // 既知の文字列を直接置換
      for (const [pattern, replacement] of Object.entries(directReplacements)) {
        // 単語単位でのマッチングのみ（部分文字列を避ける）
        const regex = new RegExp(`\\b${pattern}\\b`, 'g');
        if (regex.test(value)) {
          logger.warn(`パラメータ内の "${pattern}" を実際の値に置換します`);
          value = value.replace(regex, replacement);
        }
      }
      
      // すべての関数呼び出しパターンをチェック
      if (/\b\w+\s*\(.*?\)/.test(value)) {
        // 詳細情報を含むエラーログを出力
        logger.error(`パラメータ内に関数呼び出しパターンが見つかりました: ${value}`, {
          value: value,
          pattern: value.match(/\b\w+\s*\(.*?\)/)?.[0] || 'unknown pattern',
          detectionPhase: 'パラメータサニタイズ処理',
          valueType: typeof value,
          conversationLength: value.length
        });
        
        // 関数呼び出し部分をリテラル文字列に置換（最も安全な方法）
        return `"無効な関数パターン - 置換されました"`;
      }
      
      // テンプレート文字列パターンをエスケープ - 追加の安全対策
      value = escapeTemplateVariables(value);

      return value;
    }
    
    // 配列の場合、各要素を再帰的に変換
    if (Array.isArray(value)) {
      return value.map(convertValue);
    }
    
    // オブジェクトの場合、各プロパティを再帰的に変換
    if (typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = convertValue(val);
      }
      return result;
    }
    
    return value;
  };
  
  // 各パラメータを変換
  for (const [key, value] of Object.entries(params)) {
    safeParams[key] = convertValue(value);
  }
  
  return safeParams;
}

/**
 * タスク管理ワークフロー
 */
export const taskWorkflow: WorkflowDefinition = {
  id: 'notion-task',
  name: 'タスク管理',
  description: 'Notionを使用したタスク管理ワークフロー',
  triggers: [
    'タスク管理', 'タスク追加', 'タスク一覧', 'タスク完了', 'タスク削除', 'タスク編集', 
    'タスクを管理', 'タスクを追加', 'タスクを表示', 'タスクを完了', 'タスクを削除', 'タスクを編集',
    'TODOを追加', 'TODOを管理', 'TODOリスト', 'TODO管理',
    'ガクコお願い、タスク', 'ガクコタスク'
  ],
  requiredIntegrations: ['notion-mcp'],
  
  async execute(userQuery: string, context: WorkflowContext): Promise<WorkflowResult> {
    // MCPコネクタ取得
    const notionMcp = context.serviceConnectors?.get('notion-mcp') as NotionMCPConnector;
    
    if (!notionMcp) {
      return {
        success: false,
        message: 'Notionサービスに接続できません。サービスが正しく構成されているか確認してください。'
      };
    }
    
    try {
      // 環境変数の事前チェック - 重要なデータベースIDが設定されているか確認
      const taskDbId = process.env.NOTION_TASK_DB_ID;
      const staffDbId = process.env.NOTION_STAFF_DB_ID;
      
      // 型安全性の確保 - 環境変数は常に文字列として扱う
      if (taskDbId && typeof taskDbId !== 'string') {
        logger.error('taskDbId が文字列型ではありません', { type: typeof taskDbId });
        return {
          success: false,
          message: 'データベースIDの設定に問題があります。システム管理者にお問い合わせください。'
        };
      }
      
      if (!taskDbId) {
        logger.error('NOTION_TASK_DB_ID 環境変数が設定されていません');
        return {
          success: false,
          message: 'タスクデータベース設定が見つかりません。システム管理者にお問い合わせください。'
        };
      }
      
      if (!staffDbId) {
        logger.warn('NOTION_STAFF_DB_ID 環境変数が設定されていません');
      }
      
      // 処理中の表示
      await context.progressUpdate('タスク情報を処理中...');
      
      // 名前解決サービスの初期化
      const nameResolver = new NameResolver(context.llmClient, notionMcp);
      
      // 利用可能なツールを取得
      const availableTools = await notionMcp.getAvailableTools();
      
      // ヒストリーや会話コンテキストから追加情報を取得（あれば）
      const contextInfo = context.conversationMemory 
        ? getContextInfoFromMemory(context.conversationMemory)
        : '';
      
      // ツール選択プロンプトの構築
      const prompt = taskPrompts.buildToolSelectionPrompt(
        userQuery,
        availableTools,
        contextInfo
      );
      
      // LLMによるツール選択と実行プラン生成
      const llmResponse = await context.llmClient.generateStructuredResponse(prompt, {
        responseFormat: { type: "json_object" }
      });
      
      // LLMのレスポンスを安全にパースして検証
      let toolSelection;
      try {
        toolSelection = safeParseAndValidate(llmResponse.content);
        // 追加のエスケープ処理 - 安全対策
        toolSelection = deepEscapeTemplateVariables(toolSelection);
        logger.info(`選択されたツール: ${toolSelection.tool}`, toolSelection.parameters);
      } catch (error) {
        // エラーの詳細をログに記録
        logger.error('ツール選択の処理中にエラー:', {
          error: error instanceof Error ? error.message : String(error),
          query: userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : ''),
          responsePreview: llmResponse.content.substring(0, 50) + '...',
          errorSource: 'ツール選択のJSON解析',
          timestamp: new Date().toISOString()
        });
        
        // エラーの種類に基づいてユーザーフレンドリーなメッセージを生成
        let userMessage = 'ツール選択の処理中にエラーが発生しました。';
        if (error instanceof Error) {
          if (error.message.includes('安全でないパターン') || error.message.includes('関数')) {
            userMessage += '安全なタスク操作を行うには、変数や関数を参照せず、具体的な値を使用してください。';
          } else if (error.message.includes('JSONパース')) {
            userMessage += 'コマンドの形式に問題があります。より明確な指示を試してください。';
          }
        }
        
        return {
          success: false,
          message: userMessage
        };
      }
      
      // 特別なケースの処理: 名前解決が必要な場合
      if (toolSelection.parameters && 
          toolSelection.parameters.assignee && 
          typeof toolSelection.parameters.assignee === 'string') {
        
        // スタッフ名の解決
        const resolvedName = await nameResolver.resolveStaffName(toolSelection.parameters.assignee);
        if (resolvedName.matched) {
          toolSelection.parameters.assignee = resolvedName.staffId;
        } else {
          // 名前が解決できない場合はその旨を伝える
          return {
            success: false,
            message: `「${toolSelection.parameters.assignee}」という名前のスタッフが見つかりませんでした。`
          };
        }
      }
      
      // 特別なケースの処理: 定期タスク生成
      if (toolSelection.tool === 'generate_recurring_tasks') {
        return await handleRecurringTaskGeneration(
          notionMcp, 
          context,
          toolSelection.parameters,
          nameResolver
        );
      }
      
      // パラメータ整形 - 変換前に完全にクローンして新しいオブジェクトを作成
      const paramsClone = JSON.parse(JSON.stringify(toolSelection.parameters || {}));
      
      // sanitizeParametersを使用した安全なパラメータ処理
      const finalParameters = sanitizeParameters(paramsClone);
      
      // 深層チェック - 追加のセキュリティ確認として残す
      const dangerousPattern = deepScanForDangerousPatterns(finalParameters);
      if (dangerousPattern) {
        // JSONの抜粋を取得して文脈を追加
        const paramsSample = JSON.stringify(finalParameters).substring(0, 200) + '...';
        
        // 詳細なエラーログ
        logger.error(`サニタイズ後も危険なパターンが残っています: ${dangerousPattern.pattern} at ${dangerousPattern.path}`, {
          pattern: dangerousPattern.pattern,
          path: dangerousPattern.path,
          paramsSample: paramsSample,
          detectionPhase: 'パラメータサニタイズ後の検証',
          originalQuery: userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : ''),
          tool: toolSelection.tool
        });
        
        // ユーザーに対してより具体的なフィードバック
        const errorMessage = getErrorSuggestion(dangerousPattern.pattern);
        return {
          success: false,
          message: `パラメータに不正な形式が含まれています: ${dangerousPattern.pattern}. ${errorMessage}`
        };
      }
      
      // ツール名決定 - queryDatabaseなどの一般的なツール名をMCPサーバーで使用するツール名に変換
      let mcpToolName = 'queryDatabase'; // デフォルトのツール名
      
      // LLMが提案したツール名に基づいてMCPで使用するツール名と必要なパラメータを準備
      switch (toolSelection.tool) {
        case 'queryDatabase':
          mcpToolName = 'queryDatabase';
          // データベースIDの明示的な設定
          if (finalParameters.database_id) {
            // 文字列として環境変数名が含まれている場合は実際の値に置換
            if (typeof finalParameters.database_id === 'string') {
              if (finalParameters.database_id.includes('NOTION_TASK_DB_ID')) {
                finalParameters.database_id = taskDbId;
              } else if (finalParameters.database_id.includes('NOTION_STAFF_DB_ID')) {
                finalParameters.database_id = staffDbId;
              }
            }
          } else {
            // デフォルトでタスクDBを使用
            finalParameters.database_id = taskDbId;
          }
          break;
          
        case 'createPage':
          mcpToolName = 'createPage';
          // parentプロパティがない場合は作成
          if (!finalParameters.parent) {
            finalParameters.parent = { database_id: taskDbId };
          } 
          // parent.database_idの明示的な設定
          else if (finalParameters.parent.database_id) {
            if (typeof finalParameters.parent.database_id === 'string') {
              if (finalParameters.parent.database_id.includes('NOTION_TASK_DB_ID')) {
                finalParameters.parent.database_id = taskDbId;
              } else if (finalParameters.parent.database_id.includes('NOTION_STAFF_DB_ID')) {
                finalParameters.parent.database_id = staffDbId;
              }
            }
          } else {
            finalParameters.parent.database_id = taskDbId;
          }
          break;
          
        case 'updatePage':
        case 'deletePage':
        case 'retrievePage':
          mcpToolName = toolSelection.tool;
          break;
          
        case 'retrieveDatabase':
          mcpToolName = 'retrieveDatabase';
          // データベースIDの明示的な設定
          if (finalParameters.database_id) {
            if (typeof finalParameters.database_id === 'string') {
              if (finalParameters.database_id.includes('NOTION_TASK_DB_ID')) {
                finalParameters.database_id = taskDbId;
              } else if (finalParameters.database_id.includes('NOTION_STAFF_DB_ID')) {
                finalParameters.database_id = staffDbId;
              }
            }
          } else {
            finalParameters.database_id = taskDbId;
          }
          break;
          
        default:
          // デフォルトでqueryDatabaseを使用
          mcpToolName = 'queryDatabase';
          finalParameters.database_id = taskDbId;
      }
      
      // 最終パラメータのログ記録
      logger.debug(`MCPコマンド実行前: ${mcpToolName}、パラメータ詳細:`, JSON.stringify(finalParameters, null, 2));
      
      // MCPツールの実行 - 整形したパラメータを使用
      const result = await notionMcp.execute(
        mcpToolName, 
        finalParameters
      );
      logger.debug(`MCPコマンド実行後: ${mcpToolName}、結果:`, JSON.stringify(result, null, 2));
      
      // エラー処理
      if (!result.success) {
        return {
          success: false,
          message: taskPrompts.formatErrorMessage(result.error)
        };
      }
      
      // タスク作成や更新の場合、リマインダー設定
      if ((toolSelection.tool === 'create_task' || toolSelection.tool === 'update_task') && 
          result.success && 
          result.data.dueDate) {
            
        const dueDate = new Date(result.data.dueDate);
        const taskId = result.data.id;
        const taskTitle = result.data.title || 'タスク';
        
        // リマインダー設定（期限が未来の場合のみ）
        if (dueDate > new Date() && reminderService) {
          await reminderService.scheduleReminder(
            taskId, 
            taskTitle,
            dueDate, 
            context.channelId
          );
        }
      }
      
      // 結果の整形と返却
      return {
        success: true,
        message: taskPrompts.formatResponse(result.data, toolSelection.tool),
        data: result.data
      };
    } catch (error) {
      // 詳細な構造化ログ記録
      logger.error('タスクワークフローエラー:', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'スタック情報なし',
        errorName: error instanceof Error ? error.name : 'エラー名不明',
        query: userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : ''),
        timestamp: new Date().toISOString(),
        errorLocation: 'タスクワークフローメイン処理'
      });
      
      // エラーの種類に基づいたユーザーフレンドリーなメッセージ
      let userMessage = 'タスク処理中にエラーが発生しました。';
      
      if (error instanceof Error) {
        if (error.message.includes('安全でないパターン') || error.message.includes('関数')) {
          userMessage += '安全なタスク操作を行うには、変数や関数を参照せず、具体的な値を使用してください。';
        } else if (error.message.includes('データベース') || error.message.includes('Database')) {
          userMessage += 'データベース操作に問題があります。コマンドの形式を見直してください。';
        } else if (error.message.includes('タイムアウト') || error.message.includes('timeout')) {
          userMessage += '処理に時間がかかりすぎました。もう少し簡単な操作を試してください。';
        }
      }
      
      return {
        success: false,
        message: userMessage
      };
    }
  },
  
  onError: async (error: Error, userQuery: string, context: WorkflowContext) => {
    logger.error('タスクワークフローエラー:', error);
    return {
      success: false,
      message: 'タスク管理中にエラーが発生しました。もう一度お試しください。'
    };
  }
}

/**
 * 定期タスク生成の処理
 * @param notionMcp NotionMCPコネクタ
 * @param context コンテキスト
 * @param parameters パラメータ
 * @param nameResolver 名前解決サービス
 * @returns ワークフロー結果
 */
async function handleRecurringTaskGeneration(
  notionMcp: NotionMCPConnector,
  context: WorkflowContext,
  parameters: Record<string, any>,
  nameResolver: NameResolver
): Promise<WorkflowResult> {
  try {
    // 環境変数が設定されているか確認
    const taskDbId = process.env.NOTION_TASK_DB_ID;
    if (!taskDbId) {
      logger.error('NOTION_TASK_DB_ID 環境変数が設定されていません');
      return {
        success: false,
        message: 'タスクデータベース設定が見つかりません。システム管理者にお問い合わせください。'
      };
    }
    
    // 型安全性の確保 - taskDbIdは文字列型として扱う
    if (typeof taskDbId !== 'string') {
      logger.error('taskDbId が文字列型ではありません', { type: typeof taskDbId });
      return {
        success: false,
        message: 'データベースIDの設定に問題があります。システム管理者にお問い合わせください。'
      };
    }
    
    // 基本タスク情報の取得
    // retrievePage ツールで正確なAPI呼び出しを行う
    const baseTaskResult = await notionMcp.execute('retrievePage', { 
      page_id: parameters.baseTaskId 
    });
    
    if (!baseTaskResult.success) {
      return {
        success: false,
        message: `基本タスクの取得に失敗しました: ${baseTaskResult.error}`
      };
    }
    
    // LLMによる定期タスク生成
    const generationPrompt = buildRecurringTaskGenerationPrompt(
      baseTaskResult.data,
      parameters.period
    );
    
    const llmResponse = await context.llmClient.generateStructuredResponse(generationPrompt, {
      responseFormat: { type: "json_object" }
    });
    
    // 生成タスクの配列を取得 - 安全にパース
    let tasksToCreate;
    try {
      tasksToCreate = safeParseAndValidate(llmResponse.content);
      // 追加のエスケープ処理 - 安全対策
      tasksToCreate = deepEscapeTemplateVariables(tasksToCreate);
    } catch (error) {
      logger.error('定期タスク生成のレスポンス処理中にエラー:', error);
      return {
        success: false,
        message: `定期タスク生成中にエラーが発生しました。安全にタスクを生成するには、より明確なプロンプトを試してください。`
      };
    }
    
    // 各タスクを作成
    const createdTasks = [];
    for (const task of tasksToCreate) {
      // 担当者情報がある場合は名前解決
      if (task.assignee && typeof task.assignee === 'string') {
        const resolvedName = await nameResolver.resolveStaffName(task.assignee);
        if (resolvedName.matched) {
          task.assignee = resolvedName.staffId;
        } else {
          task.assignee = baseTaskResult.data.assignee;
        }
      }
      
      // 元のタスクの情報とマージ
      const taskData = {
        ...baseTaskResult.data,
        title: task.title,
        dueDate: task.dueDate,
        ...task.properties
      };
      
      // 正しいAPIツール（createPage）を使ってタスクを作成
      const taskDbId = process.env.NOTION_TASK_DB_ID;
      
      // taskDbIdの型チェック - 関数ではなく文字列であることを確認
      if (typeof taskDbId !== 'string') {
        logger.error('taskDbIdが文字列型ではありません', { type: typeof taskDbId });
        return {
          success: false,
          message: 'データベースID設定に問題があります。システム管理者にお問い合わせください。'
        };
      }
      
      // Notionフォーマットに変換
      const properties: any = {
        'タイトル': {
          title: [{ text: { content: task.title } }]
        }
      };
      
      // 状態が設定されていれば追加
      if (taskData.status) {
        properties['ステータス'] = {
          select: { name: taskData.status }
        };
      }
      
      // 期限が設定されていれば追加
      if (task.dueDate) {
        properties['期限日'] = {
          date: { start: task.dueDate }
        };
      }
      
      // 担当者が設定されていれば追加
      if (task.assignee) {
        properties['担当者'] = {
          people: [{ id: task.assignee }]
        };
      }
      
      // createPage ツールを実行
      const createResult = await notionMcp.execute('createPage', {
        parent: { database_id: taskDbId },
        properties: properties
      });
      
      if (createResult.success) {
        createdTasks.push(createResult.data);
        
        // リマインダーの設定
        const dueDate = new Date(task.dueDate);
        if (dueDate > new Date() && reminderService) {
          await reminderService.scheduleReminder(
            createResult.data.id,
            task.title,
            dueDate,
            context.channelId
          );
        }
      }
    }
    
    return {
      success: true,
      message: `${createdTasks.length}件の定期タスクを作成しました。`,
      data: createdTasks
    };
  } catch (error) {
    logger.error('定期タスク生成エラー:', error);
    return {
      success: false,
      message: `定期タスクの生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 定期タスク生成用プロンプト構築
 * @param baseTask 基本タスク
 * @param period 期間
 * @returns 構築されたプロンプト
 */
function buildRecurringTaskGenerationPrompt(baseTask: any, period: string): string {
  return `
    以下の基本タスク情報を元に、${period}の定期タスクを生成してください。
    
    基本タスク:
    ${JSON.stringify(baseTask, null, 2)}
    
    生成する定期タスクとして適切な期限と名前の修正（必要な場合）を行い、JSONで出力してください。
    複数のタスクを生成する場合は配列形式で出力してください。
    
    最も重要: あなたの出力が JSON として安全であることを確認してください
    - データベースIDや変数を参照する式ではなく、常に具体的な文字列値を使用してください
    - taskDbId や TASK_DB_ID などの変数名を文字列として出力することさえ避けてください
    - 関数形式（丸括弧を含む式）は絶対に出力しないでください
    - JSONの全フィールドは必ず文字列リテラル、数値リテラル、配列リテラル、またはオブジェクトリテラルのみを使用してください
    
    出力フォーマット:
    [
      { "title": "タスク名", "dueDate": "YYYY-MM-DD", "properties": { 追加・変更するプロパティ } },
      ...
    ]
  `;
}

/**
 * 会話メモリから文脈情報を抽出
 * @param memory 会話メモリ
 * @returns 文脈情報
 */
function getContextInfoFromMemory(memory: any): string {
  // 会話メモリから関連情報を抽出するロジック
  // 実際の実装はメモリの構造に依存
  if (!memory || !memory.messages || memory.messages.length === 0) {
    return '';
  }
  
  // 最新のいくつかの会話を文脈として使用
  const recentMessages = memory.messages.slice(-3);
  
  return `最近の会話:\n${recentMessages.map((msg: any) => 
    `${msg.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${msg.content}`
  ).join('\n')}`;
}
