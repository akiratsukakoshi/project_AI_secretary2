/**
 * カレンダー関連のプロンプトテンプレート
 * Google Calendarワークフローで使用するプロンプトを定義
 */

/**
 * カレンダー関連のプロンプトテンプレート
 */
export const calendarPrompts = {
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
    const toolDescriptions = availableTools.map(tool => 
      `- ${tool.name}: ${tool.description}\n  パラメータ: ${JSON.stringify(tool.parameters)}`
    ).join('\n');
    
    return `
あなたはGoogle Calendarを操作するエージェントです。
ユーザーの要求: "${userQuery}"

${contextInfo ? `コンテキスト情報:\n${contextInfo}\n\n` : ''}
利用可能なツール:
${toolDescriptions}

これらのツールを使って、ユーザーの要求に応えてください。
必要なパラメータが不足している場合は、適切に推測するか結果に不確かさを記載してください。

ツール選択と必要なパラメータをJSON形式で出力してください。
出力形式: 
{
  "tool": "ツール名",
  "parameters": {
    "パラメータ名": "値",
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
      case 'list_events':
        if (!data || data.length === 0) {
          return '指定された期間に予定はありません。';
        }
        
        return `予定一覧:\n${data.map((event: any, i: number) => 
          `${i+1}. ${event.title} - ${formatDateRange(event.start, event.end)}`
        ).join('\n')}`;
        
      case 'create_event':
        return `新しい予定「${data.title}」を ${formatDateRange(data.start, data.end)} に作成しました。`;
        
      case 'update_event':
        return `予定「${data.title}」を更新しました。`;
        
      case 'delete_event':
        return `予定を削除しました。`;
        
      default:
        return `操作が完了しました: ${JSON.stringify(data)}`;
    }
  },

  /**
   * カレンダーエラーメッセージのフォーマット
   * @param error エラー情報
   * @returns フォーマットされたエラーメッセージ
   */
  formatErrorMessage: (error: any): string => {
    // エラーの種類に応じたメッセージを返す
    const errorCode = error.code || '';
    const errorMessage = error.message || '不明なエラーが発生しました';

    switch (errorCode) {
      case 'PERMISSION_DENIED':
        return 'カレンダーへのアクセス権限がありません。カレンダーの共有設定を確認してください。';
      case 'NOT_FOUND':
        return '指定された予定や日時が見つかりませんでした。正しい情報を入力してください。';
      case 'ALREADY_EXISTS':
        return '同じ時間帯に既に予定が存在します。別の時間を選択してください。';
      case 'INVALID_ARGUMENT':
        return '入力情報が正しくありません。日時や予定の詳細を確認してください。';
      default:
        return `カレンダー操作中にエラーが発生しました: ${errorMessage}`;
    }
  }
};

/**
 * 日付範囲のフォーマット用ヘルパー関数
 * @param start 開始日時
 * @param end 終了日時
 * @returns フォーマットされた日付範囲文字列
 */
function formatDateRange(start: any, end: any): string {
  if (!start || !end) return '日時不明';
  
  try {
    // 文字列の場合はDateオブジェクトに変換
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;
    
    // 同じ日かどうかをチェック
    const isSameDay = startDate.getFullYear() === endDate.getFullYear() && 
                      startDate.getMonth() === endDate.getMonth() && 
                      startDate.getDate() === endDate.getDate();
    
    if (isSameDay) {
      // 同じ日の場合は「2023年4月1日 13:00〜15:00」のようなフォーマット
      return `${formatDate(startDate)} ${formatTime(startDate)}〜${formatTime(endDate)}`;
    } else {
      // 異なる日の場合は「2023年4月1日 13:00〜2023年4月2日 15:00」のようなフォーマット
      return `${formatDate(startDate)} ${formatTime(startDate)}〜${formatDate(endDate)} ${formatTime(endDate)}`;
    }
  } catch (error) {
    console.error('日付フォーマットエラー:', error);
    return `${start} 〜 ${end}`;
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
 * 時間のフォーマット
 * @param date 日付
 * @returns フォーマットされた時間文字列
 */
function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}
