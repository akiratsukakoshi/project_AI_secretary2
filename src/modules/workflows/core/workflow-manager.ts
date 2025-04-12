import { WorkflowDefinition, WorkflowResult, WorkflowContext } from './workflow-types';
import workflowRegistry from './workflow-registry';
import stateManager from './state-manager';
import logger from '../../../utilities/logger';
import { OpenAIClient } from '../llm/llm-client';
import { ToolSelector } from '../llm/tool-selector';

/**
 * ワークフローマネージャークラス
 * v2.0: ユーザー入力の解析からワークフローの実行までを管理
 * - パラメータ抽出からユーザークエリの直接処理に変更
 * - サービスコネクタの管理を追加
 */
export class WorkflowManager {
  private llmClient: OpenAIClient;
  private toolSelector: ToolSelector;
  private serviceConnectors: Map<string, any>; // ServiceConnector型のマップ
  
  /**
   * コンストラクタ
   * @param openaiApiKey OpenAI APIキー
   * @param serviceConnectors サービスコネクター
   */
  constructor(openaiApiKey: string, serviceConnectors: Map<string, any> = new Map()) {
    this.llmClient = new OpenAIClient(openaiApiKey);
    this.toolSelector = new ToolSelector(this.llmClient);
    this.serviceConnectors = serviceConnectors;
  }
  
  /**
   * ユーザー入力からワークフローを識別して実行
   * @param message ユーザーメッセージ情報
   * @returns ワークフロー実行結果またはnull（ワークフローが見つからない場合）
   */
  async processMessage(message: {
    content: string;
    userId: string;
    channelId: string;
    messageId: string;
  }): Promise<WorkflowResult | null> {
    const { content, userId, channelId, messageId } = message;
    
    // 1. 保存されたステートがあるか確認（マルチターン対話の継続）
    const savedState = await stateManager.getState(userId);
    if (savedState && savedState.workflow) {
      logger.info(`継続的なワークフローを処理: ${savedState.workflow}, ステップ: ${savedState.step || 'unknown'}`);
      return this.continueWorkflow(savedState, content, { userId, channelId, messageId });
    }
    
    // 2. ワークフロートリガーに基づいてワークフローを特定
    const workflow = workflowRegistry.findWorkflowByTrigger(content);
    
    if (!workflow) {
      logger.debug('ワークフローは見つかりませんでした。通常の対話処理に戻ります。');
      return null;
    }
    
    logger.info(`ワークフロー "${workflow.id}" を検出しました。実行を開始します。`);
    
    // 3. ワークフローを実行（v2.0: 生のユーザークエリを渡す）
    return this.executeWorkflow(workflow, content, { userId, channelId, messageId });
  }
  
  /**
   * ワークフロー実行
   * @param workflow 実行するワークフロー
   * @param userQuery ユーザークエリ
   * @param messageInfo メッセージ情報
   * @returns 実行結果
   */
  private async executeWorkflow(
    workflow: WorkflowDefinition,
    userQuery: string,
    messageInfo: { userId: string; channelId: string; messageId: string }
  ): Promise<WorkflowResult> {
    const { userId, channelId, messageId } = messageInfo;
    
    // コンテキスト作成
    const context: WorkflowContext = {
      userId,
      channelId,
      messageId,
      conversationMemory: {}, // 本来はメモリサービスから取得
      sendResponse: async (message) => {
        // ここではダミー実装。実際の実装ではDiscordに送信する
        logger.debug(`応答送信: ${message}`);
      },
      progressUpdate: async (message) => {
        // ここではダミー実装。実際の実装ではタイピング表示などを行う
        logger.debug(`進捗更新: ${message}`);
      },
      serviceConnectors: this.serviceConnectors, // v2.0: サービスコネクタのマップ
      llmClient: this.llmClient,
      stateManager: stateManager
    };
    
    try {
      // ワークフロー実行開始をログ
      logger.info(`ワークフロー "${workflow.id}" を実行中...`);
      
      // ワークフロー実行（v2.0: 生のユーザークエリを渡す）
      const result = await workflow.execute(userQuery, context);
      
      // ワークフロー結果の記録
      logger.info(`ワークフロー "${workflow.id}" 完了: ${result.success ? '成功' : '失敗'}`);
      
      return result;
    } catch (error) {
      logger.error(`ワークフロー "${workflow.id}" 実行中にエラー:`, error);
      
      // エラーハンドラがあれば実行
      if (workflow.onError) {
        return workflow.onError(error as Error, userQuery, context);
      }
      
      // デフォルトエラーレスポンス
      return {
        success: false,
        message: `ワークフロー実行中にエラーが発生しました: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * 保存されたステートから会話を継続
   * @param state 保存された状態
   * @param userInput ユーザー入力
   * @param messageInfo メッセージ情報
   * @returns 実行結果
   */
  private async continueWorkflow(
    state: any,
    userInput: string,
    messageInfo: { userId: string; channelId: string; messageId: string }
  ): Promise<WorkflowResult> {
    const { userId, channelId, messageId } = messageInfo;
    const workflow = workflowRegistry.getWorkflow(state.workflow);
    
    if (!workflow) {
      await stateManager.clearState(userId);
      return {
        success: false,
        message: 'ワークフローの状態が無効です。もう一度お試しください。'
      };
    }
    
    logger.info(`ワークフロー "${workflow.id}" を継続、ステップ: ${state.step || 'unknown'}`);
    
    // コンテキスト作成
    const context: WorkflowContext = {
      userId,
      channelId,
      messageId,
      conversationMemory: {}, // 本来はメモリサービスから取得
      sendResponse: async (message) => {
        // ここではダミー実装。実際の実装ではDiscordに送信する
        logger.debug(`応答送信: ${message}`);
      },
      progressUpdate: async (message) => {
        // ここではダミー実装。実際の実装ではタイピング表示などを行う
        logger.debug(`進捗更新: ${message}`);
      },
      serviceConnectors: this.serviceConnectors, // v2.0: サービスコネクタのマップ
      llmClient: this.llmClient,
      stateManager: stateManager
    };
    
    try {
      // v2.0: 状態とユーザー入力を組み合わせたJSONを渡す
      const stateContextQuery = JSON.stringify({
        state: state,
        userInput: userInput
      });
      
      // ワークフロー実行
      const result = await workflow.execute(stateContextQuery, context);
      
      // ステート消去（必要に応じてワークフローの結果に基づいて判断することもある）
      if (result.success && !result.data?.requireFollowUp) {
        await stateManager.clearState(userId);
      }
      
      return result;
    } catch (error) {
      logger.error(`ワークフロー継続中にエラー:`, error);
      
      // 状態をクリア
      await stateManager.clearState(userId);
      
      // エラーハンドラがあれば実行
      if (workflow.onError) {
        return workflow.onError(error as Error, userInput, context);
      }
      
      // デフォルトエラーレスポンス
      return {
        success: false,
        message: `ワークフロー実行中にエラーが発生しました: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * サービスコネクタを追加
   * @param id サービスID
   * @param connector サービスコネクタ
   */
  addServiceConnector(id: string, connector: any): void {
    this.serviceConnectors.set(id, connector);
    logger.info(`サービスコネクタ "${id}" を追加しました。`);
  }
  
  /**
   * サービスコネクタを取得
   * @param id サービスID
   * @returns サービスコネクタまたはundefined
   */
  getServiceConnector(id: string): any {
    return this.serviceConnectors.get(id);
  }
}
