/**
 * リマインダーサービス
 * タスクのリマインド機能を提供
 */

import logger from '../../../utilities/logger';

/**
 * Discordサービスインターフェース
 */
interface DiscordService {
  sendMessage(channelId: string, message: string): Promise<void>;
}

/**
 * リマインド情報インターフェース
 */
interface ReminderInfo {
  taskId: string;
  taskTitle: string;
  channelId: string;
  dueDate: Date;
  reminderType: string;
}

/**
 * リマインダーサービス
 */
export class ReminderService {
  private discordService: DiscordService;
  private reminderQueue: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * コンストラクタ
   * @param discordService Discordサービス
   */
  constructor(discordService: DiscordService) {
    this.discordService = discordService;
  }
  
  /**
   * タスクのリマインダーをスケジュール
   * @param taskId タスクID
   * @param taskTitle タスクタイトル
   * @param dueDate 期限日時
   * @param channelId 通知先チャンネルID
   */
  async scheduleReminder(
    taskId: string, 
    taskTitle: string,
    dueDate: Date, 
    channelId: string
  ): Promise<void> {
    const now = new Date();
    
    // 期限の1日前、3時間前、1時間前にリマインド
    const reminderTimes = [
      { hours: 24, name: '1日前' },
      { hours: 3, name: '3時間前' },
      { hours: 1, name: '1時間前' }
    ];
    
    for (const reminder of reminderTimes) {
      const reminderTime = new Date(dueDate.getTime() - reminder.hours * 60 * 60 * 1000);
      
      // 既に過ぎた時間はスキップ
      if (reminderTime <= now) continue;
      
      // リマインダーIDの生成
      const reminderId = `${taskId}_${reminder.hours}`;
      
      // 既存のリマインダーがあればクリア
      if (this.reminderQueue.has(reminderId)) {
        clearTimeout(this.reminderQueue.get(reminderId));
      }
      
      // 新しいリマインダーをセット
      const timeoutMs = reminderTime.getTime() - now.getTime();
      const timeout = setTimeout(async () => {
        await this.sendReminder({
          taskId,
          taskTitle,
          channelId,
          dueDate,
          reminderType: reminder.name
        });
        this.reminderQueue.delete(reminderId);
      }, timeoutMs);
      
      this.reminderQueue.set(reminderId, timeout);
      logger.info(`タスク「${taskTitle}」(ID: ${taskId})のリマインダーを${reminderTime.toLocaleString('ja-JP')}(${reminder.name})に設定しました`);
    }
  }
  
  /**
   * リマインダーの更新
   * @param taskId タスクID
   * @param taskTitle タスクタイトル
   * @param newDueDate 新しい期限日時
   * @param channelId 通知先チャンネルID
   */
  async updateReminder(
    taskId: string, 
    taskTitle: string,
    newDueDate: Date, 
    channelId: string
  ): Promise<void> {
    await this.cancelReminder(taskId);
    await this.scheduleReminder(taskId, taskTitle, newDueDate, channelId);
  }
  
  /**
   * リマインダーのキャンセル
   * @param taskId タスクID
   */
  async cancelReminder(taskId: string): Promise<void> {
    // taskIdで始まるすべてのリマインダーを検索してキャンセル
    for (const [reminderId, timeout] of this.reminderQueue.entries()) {
      if (reminderId.startsWith(`${taskId}_`)) {
        clearTimeout(timeout);
        this.reminderQueue.delete(reminderId);
        logger.info(`タスクID「${taskId}」のリマインダーをキャンセルしました`);
      }
    }
  }
  
  /**
   * リマインダー通知の送信
   * @param reminderInfo リマインド情報
   */
  private async sendReminder(reminderInfo: ReminderInfo): Promise<void> {
    const { taskId, taskTitle, channelId, dueDate, reminderType } = reminderInfo;
    
    const message = `⏰ **リマインド: タスク期限${reminderType}** ⏰
    
タスク「${taskTitle}」の期限が近づいています。
期限: ${formatDate(dueDate)}

[Notionで確認する](https://www.notion.so/${taskId.replace(/-/g, '')})`;
    
    try {
      await this.discordService.sendMessage(channelId, message);
      logger.info(`タスク「${taskTitle}」(${reminderType})のリマインドを送信しました`);
    } catch (error) {
      logger.error(`タスク${taskId}のリマインド送信に失敗しました:`, error);
    }
  }
  
  /**
   * 朝の日次タスクリマインド（9:00AM）
   * @param channelId 通知先チャンネルID
   * @param notionMcp Notion MCPコネクタ (オプション)
   */
  async scheduleDailyReminder(channelId: string): Promise<void> {
    // 毎朝9時に実行する処理をセット
    const now = new Date();
    const target = new Date();
    
    // 今日の9時がまだの場合は今日の9時に設定、過ぎていれば明日の9時
    if (now.getHours() < 9) {
      target.setHours(9, 0, 0, 0);
    } else {
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    }
    
    // タイマーセット（ミリ秒）
    const timeUntilTarget = target.getTime() - now.getTime();
    
    setTimeout(async () => {
      await this.sendDailyReminder(channelId);
      // 次の日も自動的にスケジュール
      this.scheduleDailyReminder(channelId);
    }, timeUntilTarget);
    
    logger.info(`日次リマインダーを${target.toLocaleString('ja-JP')}にスケジュールしました`);
  }
  
  /**
   * 日次リマインド送信
   * @param channelId 通知先チャンネルID
   */
  private async sendDailyReminder(channelId: string): Promise<void> {
    try {
      const today = formatDate(new Date());
      
      const message = `🌞 **${today}の予定タスク** 🌞
      
今日が期限のタスクを確認してください。
詳細は「今日のタスク」と質問してください。`;
      
      await this.discordService.sendMessage(channelId, message);
      logger.info(`${today}の日次リマインドを送信しました`);
    } catch (error) {
      logger.error('日次リマインドの送信に失敗しました:', error);
    }
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
 * シングルトンインスタンス（初期化は外部から行う）
 */
export let reminderService: ReminderService | null = null;

/**
 * リマインダーサービスの初期化
 * @param discordService Discordサービス
 */
export function initializeReminderService(discordService: DiscordService): void {
  if (!reminderService) {
    reminderService = new ReminderService(discordService);
    logger.info('リマインダーサービスを初期化しました');
  }
}
