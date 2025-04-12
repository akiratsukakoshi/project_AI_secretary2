/**
 * タスク管理関連のプロンプトテンプレート
 * Notionタスク管理ワークフローで使用するプロンプトを定義
 */

/**
 * タスク管理関連のプロンプトテンプレート
 */
export const taskPrompts = {
  /**
   * ツール選択プロンプトを構築
   * @param userQuery ユーザークエリ
   * @param availableTools 利用可能なツール一覧
   * @param contextInfo 追加コンテキスト情報
   * @returns 構築されたプロンプト
   */
  buildToolSelectionPrompt: (
    userQuery: string, 
    availableTools: Array<{
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>,
    contextInfo?: string
  ): string => {
    const toolDescriptions = availableTools.map(tool => {
      const paramsDescription = Object.entries(tool.parameters).map(
        ([name, desc]) => `    - ${name}: ${desc}`
      ).join('\n');
      
      return `- ${tool.name}: ${tool.description}\n  Parameters:\n${paramsDescription}`;
    }).join('\n\n');
    
    return `
あなたはNotionデータベースを使ったタスク管理アシスタントです。
ユーザーの要求: "${userQuery}"

${contextInfo ? `コンテキスト情報:\n${contextInfo}\n\n` : ''}
利用可能なツール:
${toolDescriptions}

これらのツールの中から、ユーザーの要求に最も適したツールを選び、必要なパラメータを抽出または推測してください。
特に重要なのは、タスクのアクション（追加/一覧/完了/削除）を正確に判断することです。

ツール選択と必要なパラメータをJSON形式で出力してください。
出力形式: 
{
  "tool": "選択したツール名",
  "parameters": {
    "パラメータ名": "パラメータ値",
    ...
  },
  "reasoning": "このツールを選んだ理由と、パラメータをどのように決定したか"
}
`;
  },
  
  /**
   * レスポンスをフォーマット
   * @param data APIからのレスポンスデータ
   * @param toolType 使用したツール種別
   * @returns フォーマットされたレスポンス
   */
  formatResponse: (data: any, toolType: string): string => {
    // ツール種別に応じた結果の整形ロジック
    switch (toolType) {
      case 'list_tasks':
        if (!data || data.length === 0) {
          return '条件に一致するタスクはありません。';
        }
        
        return formatTaskList(data);
        
      case 'create_task':
        return `新しいタスク「${data.title}」を作成しました。${data.dueDate ? `\n期限: ${formatDate(new Date(data.dueDate))}` : ''}`;
        
      case 'update_task':
        return `タスク「${data.title}」を更新しました。`;
        
      case 'complete_task':
        return `タスク「${data.title}」を完了としてマークしました。`;
        
      case 'delete_task':
        return `タスク「${data.title}」を削除しました。`;
        
      case 'get_task_details':
        return formatTaskDetail(data);
        
      default:
        return `操作が完了しました: ${JSON.stringify(data)}`;
    }
  },

  /**
   * タスク管理のエラーメッセージをフォーマット
   * @param error エラー情報
   * @returns フォーマットされたエラーメッセージ
   */
  formatErrorMessage: (error: any): string => {
    // エラーの種類に応じたメッセージを返す
    const errorCode = error.code || '';
    const errorMessage = error.message || '不明なエラーが発生しました';

    switch (errorCode) {
      case 'PERMISSION_DENIED':
        return 'Notionデータベースへのアクセス権限がありません。';
      case 'NOT_FOUND':
        return '指定されたタスクが見つかりませんでした。正しいタイトルやIDを入力してください。';
      case 'INVALID_ARGUMENT':
        return '入力情報が正しくありません。タスクの詳細情報を確認してください。';
      default:
        return `タスク操作中にエラーが発生しました: ${errorMessage}`;
    }
  }
};

/**
 * タスク一覧を整形
 * @param tasks タスク一覧
 * @returns 整形されたタスク一覧文字列
 */
function formatTaskList(tasks: any[]): string {
  let message = `タスク一覧 (${tasks.length}件):\n\n`;
  
  tasks.forEach((task, index) => {
    const dueStr = task.dueDate ? ` (期限: ${formatDate(new Date(task.dueDate))})` : '';
    const priorityMark = getPriorityMark(task.priority);
    
    message += `${index + 1}. ${priorityMark} ${task.title}${dueStr}\n`;
    if (task.assignee) {
      message += `   担当: ${task.assignee}\n`;
    }
    if (task.status && task.status !== 'pending') {
      message += `   状態: ${formatStatus(task.status)}\n`;
    }
    message += '\n';
  });
  
  return message;
}

/**
 * タスク詳細を整形
 * @param task タスク情報
 * @returns 整形されたタスク詳細文字列
 */
function formatTaskDetail(task: any): string {
  let message = `【タスク詳細】\n`;
  message += `タイトル: ${task.title}\n`;
  
  if (task.description) {
    message += `説明: ${task.description}\n`;
  }
  
  if (task.dueDate) {
    message += `期限: ${formatDate(new Date(task.dueDate))}\n`;
  }
  
  message += `優先度: ${getPriorityMark(task.priority)} ${task.priority}\n`;
  
  if (task.category) {
    message += `カテゴリ: ${task.category}\n`;
  }
  
  if (task.assignee) {
    message += `担当: ${task.assignee}\n`;
  }
  
  message += `ステータス: ${formatStatus(task.status)}\n`;
  message += `作成日時: ${formatDateTime(new Date(task.createdAt))}\n`;
  
  if (task.completedAt) {
    message += `完了日時: ${formatDateTime(new Date(task.completedAt))}\n`;
  }
  
  message += `ID: ${task.id}\n`;
  
  return message;
}

/**
 * 優先度に応じたマークを返す
 * @param priority 優先度
 * @returns 優先度を示すマーク
 */
function getPriorityMark(priority: string): string {
  switch (priority) {
    case '高': return '🔴';
    case '中': return '🟡';
    case '低': return '🟢';
    default: return '⚪';
  }
}

/**
 * ステータスの日本語表示
 * @param status ステータス
 * @returns 日本語のステータス
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'pending': return '未完了';
    case 'in_progress': return '進行中';
    case 'completed': return '完了';
    default: return status;
  }
}

/**
 * 日付のフォーマット
 * @param date 日付
 * @returns フォーマットされた日付文字列
 */
function formatDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 日時のフォーマット
 * @param date 日時
 * @returns フォーマットされた日時文字列
 */
function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}
