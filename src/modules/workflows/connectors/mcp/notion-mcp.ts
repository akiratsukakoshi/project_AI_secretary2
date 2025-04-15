/**
 * Notion MCP コネクタ
 * v2.1: MCPサーバーを通じてNotionデータベースを操作するコネクタ、認証機能強化版
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
   * @param useMcp Claude Code MCPを使用するかどうか
   * @param mcpConfigPath MCP設定ファイルパス
   */
  constructor(
    baseUrl: string = 'http://localhost:3001', 
    apiKey: string = process.env.NOTION_MCP_API_KEY || process.env.NOTION_TOKEN || '', 
    useMcp: boolean = true,
    mcpConfigPath: string = '/home/tukapontas/ai-secretary2/mcp-config.json'
  ) {
    if (!apiKey && process.env.NOTION_MCP_API_KEY) {
      logger.info('環境変数 NOTION_MCP_API_KEY からAPIキーを取得しました');
      apiKey = process.env.NOTION_MCP_API_KEY;
    } else if (!apiKey && process.env.NOTION_TOKEN) {
      logger.info('環境変数 NOTION_TOKEN からAPIキーを取得しました');
      apiKey = process.env.NOTION_TOKEN;
    }
    
    if (!apiKey) {
      logger.warn('APIキーが設定されていません。Notion APIへのリクエストは認証エラーになる可能性があります。');
    } else {
      logger.info(`Notion APIキーを設定しました (長さ: ${apiKey.length})`);
    }
    
    super(baseUrl, apiKey, useMcp, mcpConfigPath, 'notion-api');
  }
  
  /**
   * Notionサービスの説明を返す
   * (LLMがユーザークエリに対するツール選択を行う際に使用)
   */
  getServiceDescription(): string {
    // 環境変数の実際の値を取得
    const taskDbId = process.env.NOTION_TASK_DB_ID || '';
    const staffDbId = process.env.NOTION_STAFF_DB_ID || '';
    
    return `
あなたはタスク管理システム「gaku-co（ガクコ）」の一部として、Notionデータベースを使ったタスク管理を担当しています。
主に以下の機能を提供します：

1. タスクの参照・検索:
   - 担当者、状態、期限日などでタスクを検索できます
   - 例: 「がくちょーの未完了タスクを表示して」「今週締め切りのタスクは？」

2. タスク追加:
   - 新しいタスクを作成します
   - タイトル、説明、担当者、期限日、カテゴリなどの情報を設定できます
   - 例: 「議事録作成タスクを追加して、担当はガクチョで期限は金曜日まで」

3. タスク更新:
   - 既存タスクのステータス変更、担当者変更などを行います
   - 例: 「プロジェクト計画書タスクを完了にして」

重要な点:
- データベースIDの設定: 
  - タスクデータベースID: "${taskDbId}"
  - スタッフマスタデータベースID: "${staffDbId}"

- 担当者の特定方法:
  - 担当者をフィルターする際は、本名（例: "塚越暁"）ではなく必ず表示名（例: "ガクチョ"）を使用してください
  - 本名から表示名への変換には、スタッフマスタDBから情報を取得する必要があります

- スタッフ名の識別: "ガクチョ"、"がくちょー"、"塚越暁" などの異なる表記は同じ人物を指します
- 日付の解釈: "明日"、"今週金曜日"、"4/20" など様々な日付表現を適切に解釈してください
- 必要な情報の確認: タスク追加時に情報が不足している場合は、ユーザーに確認してください
    `.trim();
  }
  
  /**
   * NotionのMCPツールモックを返す
   * CLIモードでは動的にツール一覧を取得できないため、適切なツール情報を静的に提供
   */
  protected getMockAvailableTools(): Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }> {
    // 環境変数の実際の値を取得
    const taskDbId = process.env.NOTION_TASK_DB_ID || '';
    const staffDbId = process.env.NOTION_STAFF_DB_ID || '';
    
    return [
      {
        name: "queryDatabase",
        description: "タスク一覧の取得・検索を行います（フィルタ条件で絞り込み可能）",
        parameters: {
          database_id: {
            type: "string",
            description: `データベースID（タスクDBには "${taskDbId}"、スタッフDBには "${staffDbId}" を使用）`
          },
          filter: {
            type: "object",
            description: "検索条件（担当者、状態、期限日など）。担当者は表示名を使用してください"
          },
          sorts: {
            type: "array",
            description: "並び替え条件（期限日順など）"
          }
        }
      },
      {
        name: "createPage",
        description: "新しいタスクを作成します",
        parameters: {
          parent: {
            type: "object",
            description: `タスクを追加するデータベース情報。database_idには "${taskDbId}" を使用`
          },
          properties: {
            type: "object",
            description: "タスクの情報（タイトル、説明、担当者、期限など）。担当者は表示名を使用"
          }
        }
      },
      {
        name: "updatePage",
        description: "既存のタスクを更新します（状態変更、担当者変更など）",
        parameters: {
          page_id: {
            type: "string",
            description: "更新するタスクのID（NotionページID）"
          },
          properties: {
            type: "object",
            description: "更新するタスク情報（状態、期限など）。担当者は表示名を使用"
          }
        }
      }
    ];
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
    const databaseId = process.env.NOTION_TASK_DB_ID || '';
    logger.info(`タスクDBID: ${databaseId}`);
    
    // フィルター条件の構築
    const filterConditions: any[] = [];
    
    if (filters) {
      // ステータスフィルター（select型）
      if (filters.status) {
        filterConditions.push({
          property: "状態",
          select: {
            equals: filters.status
          }
        });
      }
      
      // 担当者フィルター（text型）
      if (filters.assignee) {
        filterConditions.push({
          property: "担当者",
          text: {
            contains: filters.assignee
          }
        });
      }
      
      // 期限フィルター（date型）- 正確な名称は「期限」
      if (filters.dueDate) {
        const dateString = filters.dueDate instanceof Date 
          ? filters.dueDate.toISOString().split('T')[0] 
          : filters.dueDate;
        
        filterConditions.push({
          property: "期限",
          date: {
            equals: dateString
          }
        });
      }
      
      // カテゴリフィルター（relation型）
      if (filters.category) {
        filterConditions.push({
          property: "カテゴリ",
          relation: {
            contains: filters.category
          }
        });
      }
      
      // 優先度フィルター（select型）
      if (filters.priority) {
        filterConditions.push({
          property: "優先度",
          select: {
            equals: filters.priority
          }
        });
      }
    }
    
    // クエリパラメータの構築
    const params: any = {
      database_id: databaseId
    };
    
    // フィルター条件があれば追加
    if (filterConditions.length > 0) {
      params.filter = {
        and: filterConditions
      };
    }
    
    // 期限でソート (プロパティ名は「期限」)
    params.sorts = [
      {
        property: "期限",
        direction: "ascending"
      }
    ];
    
    logger.info(`タスク一覧を取得しています`, params);
    
    // queryDatabaseツールを実行
    return this.execute('queryDatabase', params);
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
    const databaseId = process.env.NOTION_TASK_DB_ID || '';
    
    // プロパティの準備
    const properties: any = {
      'タイトル': {
        title: [
          {
            text: {
              content: params.title
            }
          }
        ]
      }
    };
    
    // 説明が指定されている場合
    if (params.description) {
      properties['説明'] = {
        rich_text: [
          {
            text: {
              content: params.description
            }
          }
        ]
      };
    }
    
    // 優先度が指定されている場合
    if (params.priority) {
      properties['優先度'] = {
        select: {
          name: params.priority
        }
      };
    }
    
    // 状態が指定されている場合
    if (params.status) {
      properties['ステータス'] = {
        select: {
          name: params.status
        }
      };
    } else {
      // デフォルトは未着手
      properties['ステータス'] = {
        select: {
          name: '未着手'
        }
      };
    }
    
    // 期限日が指定されている場合
    if (params.dueDate) {
      const dateString = params.dueDate instanceof Date 
        ? params.dueDate.toISOString().split('T')[0] 
        : params.dueDate;
      
      properties['期限'] = {
        date: {
          start: dateString
        }
      };
    }
    
    // 担当者が指定されている場合（この部分は実際のNotion APIの仕様に合わせて実装する必要がある）
    if (params.assignee) {
      // 本来は担当者のユーザーIDを取得する必要がある
      properties['担当者'] = {
        people: [
          {
            id: params.assignee // 実際にはユーザーIDが必要
          }
        ]
      };
    }
    
    // カテゴリが指定されている場合
    if (params.category) {
      // 本来はカテゴリのページIDを取得する必要がある
      properties['カテゴリ'] = {
        relation: [
          {
            id: params.category // 実際にはカテゴリページIDが必要
          }
        ]
      };
    }
    
    const requestData = {
      parent: {
        database_id: databaseId
      },
      properties: properties
    };
    
    logger.info(`タスク「${params.title}」を作成しています`);
    
    // createPageツールを実行
    return this.execute('createPage', requestData);
  }
  
  /**
   * タスクを更新
   * @param taskId タスクID（ページID）
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
    // プロパティの準備
    const properties: any = {};
    
    // タイトルが指定されている場合
    if (params.title) {
      properties['タイトル'] = {
        title: [
          {
            text: {
              content: params.title
            }
          }
        ]
      };
    }
    
    // 説明が指定されている場合
    if (params.description) {
      properties['説明'] = {
        rich_text: [
          {
            text: {
              content: params.description
            }
          }
        ]
      };
    }
    
    // 優先度が指定されている場合
    if (params.priority) {
      properties['優先度'] = {
        select: {
          name: params.priority
        }
      };
    }
    
    // 状態が指定されている場合
    if (params.status) {
      properties['ステータス'] = {
        select: {
          name: params.status
        }
      };
    }
    
    // 期限日が指定されている場合
    if (params.dueDate) {
      const dateString = params.dueDate instanceof Date 
        ? params.dueDate.toISOString().split('T')[0] 
        : params.dueDate;
      
      properties['期限'] = {
        date: {
          start: dateString
        }
      };
    }
    
    // 担当者が指定されている場合
    if (params.assignee) {
      properties['担当者'] = {
        people: [
          {
            id: params.assignee // 実際にはユーザーIDが必要
          }
        ]
      };
    }
    
    // カテゴリが指定されている場合
    if (params.category) {
      properties['カテゴリ'] = {
        relation: [
          {
            id: params.category // 実際にはカテゴリページIDが必要
          }
        ]
      };
    }
    
    const requestData = {
      page_id: taskId,
      properties: properties
    };
    
    logger.info(`タスクID「${taskId}」を更新しています`);
    
    // updatePageツールを実行
    return this.execute('updatePage', requestData);
  }
  
  /**
   * タスクを完了状態に更新
   * @param taskId タスクID（ページID）
   */
  async completeTask(taskId: string): Promise<ServiceResponse> {
    logger.info(`タスクID「${taskId}」を完了状態に更新しています`);
    
    // updatePageツールを実行して、ステータスを「完了」に設定
    return this.updateTask(taskId, {
      status: '完了'
    });
  }
  
  /**
   * タスクを削除（アーカイブ）
   * @param taskId タスクID（ページID）
   */
  async deleteTask(taskId: string): Promise<ServiceResponse> {
    logger.info(`タスクID「${taskId}」を削除（アーカイブ）しています`);
    
    // deletePage APIエンドポイントを呼び出し
    return this.execute('deletePage', {
      page_id: taskId
    });
  }
  
  /**
   * タスクをタイトルで検索
   * @param title 検索するタイトル
   */
  async findTasksByTitle(title: string): Promise<ServiceResponse> {
    logger.info(`「${title}」を含むタスクを検索しています`);
    
    const databaseId = process.env.NOTION_TASK_DB_ID || '';
    
    // タイトルフィルターを構築
    const filter = {
      property: "タイトル",
      title: {
        contains: title
      }
    };
    
    // queryDatabaseツールを実行
    return this.execute('queryDatabase', {
      database_id: databaseId,
      filter: filter
    });
  }
  
  /**
   * タスクの詳細を取得
   * @param taskId タスクID（ページID）
   */
  async getTaskDetails(taskId: string): Promise<ServiceResponse> {
    logger.info(`タスクID「${taskId}」の詳細を取得しています`);
    
    // retrievePage APIエンドポイントを呼び出し
    return this.execute('retrievePage', {
      page_id: taskId
    });
  }
}
