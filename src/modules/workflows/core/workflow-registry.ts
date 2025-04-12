import { WorkflowDefinition } from './workflow-types';
import logger from '../../../utilities/logger';

/**
 * ワークフローレジストリ
 * 全てのワークフローを登録・管理する
 */
class WorkflowRegistry {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  
  /**
   * ワークフローを登録
   * @param workflow 登録するワークフロー
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    if (this.workflows.has(workflow.id)) {
      logger.warn(`ワークフロー "${workflow.id}" は既に登録されています。上書きします。`);
    }
    
    this.workflows.set(workflow.id, workflow);
    logger.info(`ワークフロー "${workflow.id}" を登録しました。`);
  }
  
  /**
   * 登録されているワークフローを取得
   * @param id ワークフローID
   * @returns ワークフロー定義またはundefined
   */
  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }
  
  /**
   * 全てのワークフローを取得
   * @returns ワークフロー定義の配列
   */
  getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }
  
  /**
   * トリガーキーワードからワークフローを検索
   * @param message ユーザーメッセージ
   * @returns マッチしたワークフロー定義またはundefined
   */
  findWorkflowByTrigger(message: string): WorkflowDefinition | undefined {
    const normalizedMessage = message.toLowerCase();
    
    return this.getAllWorkflows().find(workflow => 
      workflow.triggers.some(trigger => {
        // 正規表現パターンのチェック
        if (trigger.startsWith('/') && trigger.endsWith('/i')) {
          // 正規表現トリガー
          const patternStr = trigger.slice(1, -2);
          try {
            const regex = new RegExp(patternStr, 'i');
            return regex.test(message);
          } catch (error) {
            logger.error(`無効な正規表現パターン: ${patternStr}`, error);
            return false;
          }
        }
        
        // 通常の文字列比較
        return normalizedMessage.includes(trigger.toLowerCase());
      })
    );
  }
  
  /**
   * ワークフローを削除
   * @param id 削除するワークフローのID
   * @returns 削除に成功したかどうか
   */
  removeWorkflow(id: string): boolean {
    if (!this.workflows.has(id)) {
      logger.warn(`ワークフロー "${id}" は登録されていません。`);
      return false;
    }
    
    this.workflows.delete(id);
    logger.info(`ワークフロー "${id}" を削除しました。`);
    return true;
  }
  
  /**
   * 全てのワークフローをクリア
   */
  clearWorkflows(): void {
    this.workflows.clear();
    logger.info('全てのワークフローを削除しました。');
  }
}

// シングルトンインスタンスをエクスポート
export default new WorkflowRegistry();
