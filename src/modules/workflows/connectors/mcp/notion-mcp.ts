/**
 * Notion MCP コネクタ
 * v2.0: MCPサーバーを通じてNotionデータベースを操作するコネクタ
 */

import { MCPConnectorBase } from './mcp-connector-base';
import { ServiceResponse } from '../../core/service-connector.interface';
import logger from '../../../../utilities/logger';

/**
 * Notion MCP コネクタ
 */
export class NotionMCPConnector extends MCPConnectorBase {
  /**
   * コンストラクタ
   * @param baseUrl MCPサーバーのベースURL
   * @param apiKey 認証用APIキー（オプション）
   */
  constructor(baseUrl: string, apiKey?: string) {
    super(baseUrl, apiKey);
  }
  
  /**
   * Notionサービスの説明を返す
   * (LLMがユーザークエリに対するツール選択を行う際に使用)
   */
  getServiceDescription(): string {
    return `
Notionデータベースを使ったタスク管理サービスです。以下の機能があります：
- タスクの検索と一覧表示
- 新規タスクの作成
- 既存タスクの編集
- タスクの完了/未完了管理
- タスクの削除
- タスクの詳細表示

タスクのタイトル、説明、期限、優先度、担当者、カテゴリなどを指定して管理できます。
    `.trim();
  }
  
  // === 便利メソッド: デフォルトパラメータを設定して、よく使う操作を簡単に呼び出せるようにする ===
  
  /**
   * タスク一覧を取得（フィルター付き）
   * @param filters フィルター条件
   */
  async getTasks(filters?: {
    status?: string;
    assignee?: string;
    priority?: string;
    dueDate?: Date | string;
    category?: string;
  }): Promise<ServiceResponse> {
    // 検索クエリのパラメータを準備
    const params: any = {};
    
    // フィルター条件があれば追加
    if (filters) {
      if (filters.status) params.status = filters.status;
      if (filters.assignee) params.assignee = filters.assignee;
      if (filters.priority) params.priority = filters.priority;
      if (filters.category) params.category = filters.category;
      
      // dueDate が Date 型の場合は ISO 文字列に変換
      if (filters.dueDate) {
        params.dueDate = filters.dueDate instanceof Date
          ? filters.dueDate.toISOString().split('T')[0] // YYYY-MM-DD形式にする
          : filters.dueDate;
      }
    }
    
    logger.info(`タスク一覧を取得しています`, params);
    
    // list_tasks ツールを実行
    return this.execute('list_tasks', params);
  }
  
  /**
   * タスクを作成
   * @param params タスクデータ
   */
  async createTask(params: {
    title: string;
    description?: string;
    dueDate?: Date | string;
    priority?: '高' | '中' | '低';
    status?: '未着手' | '進行中' | '完了';
    assignee?: string;
    category?: string;
  }): Promise<ServiceResponse> {
    // パラメータを準備
    const taskData: any = {
      title: params.title
    };
    
    // オプションパラメータを追加
    if (params.description) taskData.description = params.description;
    if (params.priority) taskData.priority = params.priority;
    if (params.status) taskData.status = params.status;
    if (params.assignee) taskData.assignee = params.assignee;
    if (params.category) taskData.category = params.category;
    
    // dueDate が Date 型の場合は ISO 文字列に変換
    if (params.dueDate) {
      taskData.dueDate = params.dueDate instanceof Date
        ? params.dueDate.toISOString().split('T')[0] // YYYY-MM-DD形式にする
        : params.dueDate;
    }
    
    logger.info(`タスク「${params.title}」を作成しています`);
    
    // create_task ツールを実行
    return this.execute('create_task', taskData);
  }
  
  /**
   * タスクを更新
   * @param taskId タスクID
   * @param params 更新内容
   */
  async updateTask(taskId: string, params: {
    title?: string;
    description?: string;
    dueDate?: Date | string;
    priority?: '高' | '中' | '低';
    status?: '未着手' | '進行中' | '完了';
    assignee?: string;
    category?: string;
  }): Promise<ServiceResponse> {
    // 更新用のデータを準備
    const updateData: any = {
      id: taskId // タスクIDは必須
    };
    
    // 更新パラメータを追加
    if (params.title) updateData.title = params.title;
    if (params.description) updateData.description = params.description;
    if (params.priority) updateData.priority = params.priority;
    if (params.status) updateData.status = params.status;
    if (params.assignee) updateData.assignee = params.assignee;
    if (params.category) updateData.category = params.category;
    
    // dueDate が Date 型の場合は ISO 文字列に変換
    if (params.dueDate) {
      updateData.dueDate = params.dueDate instanceof Date
        ? params.dueDate.toISOString().split('T')[0] // YYYY-MM-DD形式にする
        : params.dueDate;
    }
    
    logger.info(`タスクID「${taskId}」を更新しています`);
    
    // update_task ツールを実行
    return this.execute('update_task', updateData);
  }
  
  /**
   * タスクを完了状態に更新
   * @param taskId タスクID
   */
  async completeTask(taskId: string): Promise<ServiceResponse> {
    logger.info(`タスクID「${taskId}」を完了状態に更新しています`);
    
    // complete_task ツールを実行
    return this.execute('complete_task', {
      id: taskId
    });
  }
  
  /**
   * タスクを削除
   * @param taskId タスクID
   */
  async deleteTask(taskId: string): Promise<ServiceResponse> {
    logger.info(`タスクID「${taskId}」を削除しています`);
    
    // delete_task ツールを実行
    return this.execute('delete_task', {
      id: taskId
    });
  }
  
  /**
   * タスクをタイトルで検索
   * @param title 検索するタイトル
   */
  async findTasksByTitle(title: string): Promise<ServiceResponse> {
    logger.info(`「${title}」を含むタスクを検索しています`);
    
    // search_tasks ツールを実行
    return this.execute('search_tasks', {
      query: title
    });
  }
  
  /**
   * タスクの詳細を取得
   * @param taskId タスクID
   */
  async getTaskDetails(taskId: string): Promise<ServiceResponse> {
    logger.info(`タスクID「${taskId}」の詳細を取得しています`);
    
    // get_task_details ツールを実行
    return this.execute('get_task_details', {
      id: taskId
    });
  }
}
