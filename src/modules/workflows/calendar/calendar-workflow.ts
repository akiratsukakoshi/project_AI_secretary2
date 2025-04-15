/**
 * カレンダーワークフロー
 * Google Calendar MCPを使用してGoogle Calendarを操作する
 */

import { WorkflowDefinition, WorkflowResult } from '../core/workflow-types';
import { calendarPrompts } from '../prompts/calendar-prompts';
import { 
  parseDate, 
  parseDuration, 
  formatCalendarEvents, 
  formatCalendarEventDetail 
} from './calendar-helper';
import logger from '../../../utilities/logger';

/**
 * カレンダーワークフロー定義
 * v2.0: LLMによるツール選択サポート
 */
export const calendarWorkflow: WorkflowDefinition = {
  id: 'calendar',
  name: 'スケジュール管理',
  description: 'Google Calendarの予定管理ワークフロー',
  triggers: [
    '予定', 'スケジュール', 'カレンダー', '空き時間', 
    '/今日の予定/i', '/明日の予定/i', '/今週の予定/i',
    '/スケジュール.*追加/i', '/スケジュール.*登録/i', '/予定.*入れて/i',
    '/予定.*削除/i', '/予定.*変更/i', '/予定.*編集/i',
    '/いつ.*空い/i', '/日程.*調整/i'
  ],
  requiredIntegrations: ['google-calendar'],
  
  /**
   * ワークフロー実行関数
   * @param userQuery ユーザークエリ
   * @param context ワークフローコンテキスト
   * @returns 実行結果
   */
  execute: async (userQuery, context) => {
    // MCPコネクタを取得
    const calendarMCP = context.serviceConnectors?.get('google-calendar');
    
    if (!calendarMCP) {
      logger.error('Googleカレンダーサービスに接続できません');
      return {
        success: false,
        message: 'カレンダーサービスに接続できません。システム管理者にお問い合わせください。'
      };
    }
    
    // ツール選択の前に簡単な前処理を行う
    try {
      // 進捗状況を通知
      await context.progressUpdate('カレンダー情報を処理中...');
      
      // 継続的なワークフローなら状態を解析
      if (userQuery.startsWith('{') && userQuery.endsWith('}')) {
        try {
          const stateContext = JSON.parse(userQuery);
          // マルチターン会話の処理（状態に応じた継続処理）
          return await handleStatefulWorkflow(stateContext, calendarMCP, context);
        } catch (error) {
          logger.error('状態JSONのパースエラー:', error);
          return {
            success: false,
            message: '会話の状態を読み取れませんでした。もう一度お試しください。'
          };
        }
      }
      
      // 利用可能なツールを取得
      logger.info('Google Calendar MCPから利用可能なツールを取得中...');
      const availableTools = await calendarMCP.getAvailableTools();
      
      if (availableTools.length === 0) {
        logger.error('利用可能なカレンダーツールが見つかりません');
        return {
          success: false,
          message: 'カレンダーツールが利用できません。システム管理者にお問い合わせください。'
        };
      }
      
      logger.info(`${availableTools.length}個のカレンダーツールを取得しました`);
      
      // ユーザークエリから日付を抽出（コンテキスト情報として使用）
      const dateMatch = extractDateFromQuery(userQuery);
      const contextInfo = dateMatch 
        ? `クエリから抽出した日付情報: ${dateMatch.toString()}` 
        : undefined;
      
      // ツール選択プロンプトの構築
      const prompt = calendarPrompts.buildToolSelectionPrompt(
        userQuery,
        availableTools,
        contextInfo
      );
      
      // LLMによるツール選択と実行プラン生成
      logger.info('LLMがツールを選択中...');
      const llmResponse = await context.llmClient.generateStructuredResponse(prompt, {
        systemMessage: "あなたはAI秘書ガクコのカレンダーワークフローコンポーネントです。ユーザーの要求に最適なツールとパラメータを選択してください。",
        temperature: 0.2
      });
      
      // LLMのレスポンスをパース
      try {
        const toolSelection = JSON.parse(llmResponse.content);
        logger.info(`選択されたツール: ${toolSelection.tool}, 理由: ${toolSelection.reasoning?.substring(0, 50) || 'なし'}`);
        
        // MCPツールの実行
        const result = await calendarMCP.execute(
          toolSelection.tool, 
          toolSelection.parameters
        );
        
        if (!result.success) {
          logger.error(`ツール実行エラー: ${result.error}`);
          return {
            success: false,
            message: `カレンダー操作中にエラーが発生しました: ${result.error}` 
          };
        }
        
        // 結果の整形と返却
        let message = '';
        
        switch (toolSelection.tool) {
          case 'list_events':
            message = formatCalendarEvents(result.data);
            break;
          case 'get_event':
            message = formatCalendarEventDetail(result.data);
            break;
          default:
            message = calendarPrompts.formatResponse(result.data, toolSelection.tool);
        }
        
        return {
          success: true,
          message,
          data: {
            workflowId: 'calendar',
            toolUsed: toolSelection.tool,
            rawData: result.data
          }
        };
      } catch (error) {
        logger.error('ツール選択レスポンスのJSONパースエラー:', error);
        return {
          success: false,
          message: 'カレンダー操作の処理中にエラーが発生しました。もう一度お試しください。'
        };
      }
    } catch (error) {
      logger.error('カレンダーワークフロー実行エラー:', error);
      return {
        success: false,
        message: `カレンダー操作中にエラーが発生しました: ${(error as Error).message}`
      };
    }
  },
  
  /**
   * エラーハンドラ
   */
  onError: async (error, userQuery, context) => {
    logger.error('カレンダーワークフローエラー:', error);
    
    return {
      success: false,
      message: 'カレンダー操作中にエラーが発生しました。時間をおいて再度お試しいただくか、別の方法で表現してみてください。'
    };
  }
};

/**
 * 状態を持つワークフロー処理
 * @param stateContext 状態コンテキスト
 * @param calendarMCP カレンダーMCPコネクタ
 * @param context ワークフローコンテキスト
 * @returns 処理結果
 */
async function handleStatefulWorkflow(
  stateContext: any,
  calendarMCP: any,
  context: any
): Promise<WorkflowResult> {
  const { state, userInput } = stateContext;
  
  switch (state.action) {
    case 'select_event_to_edit':
    case 'select_event_to_delete':
    case 'select_event_to_move':
      // 数値入力を期待
      const indexMatch = userInput.match(/^\d+$/);
      if (!indexMatch) {
        return {
          success: false,
          message: '数字を入力してください。操作をキャンセルする場合は「キャンセル」と入力してください。',
          requireFollowUp: true
        };
      }
      
      const index = parseInt(indexMatch[0], 10) - 1;
      if (index < 0 || index >= state.events.length) {
        return {
          success: false,
          message: `1から${state.events.length}までの数字を入力してください。`,
          requireFollowUp: true
        };
      }
      
      // 選択されたイベント
      const selectedEvent = state.events[index];
      
      // アクションに応じた処理
      if (state.action === 'select_event_to_delete') {
        try {
          const result = await calendarMCP.execute('delete_event', {
            eventId: selectedEvent.id
          });
          
          if (!result.success) {
            return {
              success: false,
              message: `予定の削除中にエラーが発生しました: ${result.error}`
            };
          }
          
          return {
            success: true,
            message: `「${selectedEvent.title || selectedEvent.summary}」の予定を削除しました。`
          };
        } catch (error) {
          logger.error('予定削除エラー:', error);
          return {
            success: false,
            message: '予定の削除中にエラーが発生しました。'
          };
        }
      } else if (state.action === 'select_event_to_edit') {
        try {
          const updateData = state.newData || {};
          const result = await calendarMCP.execute('update_event', {
            eventId: selectedEvent.id,
            ...updateData
          });
          
          if (!result.success) {
            return {
              success: false,
              message: `予定の更新中にエラーが発生しました: ${result.error}`
            };
          }
          
          return {
            success: true,
            message: `「${selectedEvent.title || selectedEvent.summary}」の予定を更新しました。`
          };
        } catch (error) {
          logger.error('予定更新エラー:', error);
          return {
            success: false,
            message: '予定の更新中にエラーが発生しました。'
          };
        }
      } else if (state.action === 'select_event_to_move') {
        try {
          const newDate = state.newDate;
          const duration = state.duration;
          
          if (!newDate) {
            return {
              success: false,
              message: '新しい日時が指定されていません。'
            };
          }
          
          const result = await calendarMCP.execute('update_event', {
            eventId: selectedEvent.id,
            start: { dateTime: new Date(newDate).toISOString() },
            // 期間が指定されていれば変更、そうでなければ元の期間を維持
            ...(duration && { 
              end: { 
                dateTime: new Date(new Date(newDate).getTime() + parseDuration(duration)!).toISOString() 
              }
            })
          });
          
          if (!result.success) {
            return {
              success: false,
              message: `予定の移動中にエラーが発生しました: ${result.error}`
            };
          }
          
          return {
            success: true,
            message: `「${selectedEvent.title || selectedEvent.summary}」の予定を移動しました。`
          };
        } catch (error) {
          logger.error('予定移動エラー:', error);
          return {
            success: false,
            message: '予定の移動中にエラーが発生しました。'
          };
        }
      }
      
      return {
        success: false,
        message: `未対応のアクション「${state.action}」です。`
      };
      
    default:
      return {
        success: false,
        message: '未知の状態です。もう一度最初からお試しください。'
      };
  }
}

/**
 * クエリから日付情報を抽出
 * @param query ユーザークエリ
 * @returns 抽出された日付またはnull
 */
function extractDateFromQuery(query: string): Date | null {
  // 「今日の予定」「明日の予定」などのパターンをチェック
  if (query.includes('今日')) {
    return new Date();
  }
  
  if (query.includes('明日')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  if (query.includes('明後日')) {
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    return dayAfterTomorrow;
  }
  
  if (query.includes('昨日')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  
  // 「X月Y日」のパターンをチェック
  const monthDayMatch = query.match(/(\d{1,2})月(\d{1,2})日/);
  if (monthDayMatch) {
    return parseDate(monthDayMatch[0]);
  }
  
  // 「今週」「来週」のパターンをチェック
  if (query.includes('今週')) {
    const thisWeek = new Date();
    // 特に日付指定がなければ今日を返す
    return thisWeek;
  }
  
  if (query.includes('来週')) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }
  
  // 曜日パターンをチェック
  const weekdayMatch = query.match(/(今週|来週)の(月|火|水|木|金|土|日)曜/);
  if (weekdayMatch) {
    return parseDate(`${weekdayMatch[1]}の${weekdayMatch[2]}曜日`);
  }
  
  // 日付が見つからない場合
  return null;
}