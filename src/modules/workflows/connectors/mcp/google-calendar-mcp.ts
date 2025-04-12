/**
 * Google Calendar MCP コネクタ
 * v2.0: MCPサーバーを通じてGoogle Calendarを操作するコネクタ
 */

import { MCPConnectorBase } from './mcp-connector-base';
import { ServiceResponse } from '../../core/service-connector.interface';
import logger from '../../../../utilities/logger';

/**
 * Google Calendar MCP コネクタ
 */
export class GoogleCalendarMCPConnector extends MCPConnectorBase {
  /**
   * コンストラクタ
   * @param baseUrl MCPサーバーのベースURL
   * @param apiKey 認証用APIキー（オプション）
   */
  constructor(baseUrl: string, apiKey?: string) {
    super(baseUrl, apiKey);
  }
  
  /**
   * Google Calendarサービスの説明を返す
   * (LLMがユーザークエリに対するツール選択を行う際に使用)
   */
  getServiceDescription(): string {
    return `
Google Calendarを管理するサービスです。以下の機能があります：
- 予定の検索と表示
- 新規予定の作成
- 既存予定の編集
- 予定の削除
- 空き時間の確認

日付や時間、予定タイトルなどを指定して予定を管理できます。
    `.trim();
  }
  
  // === 便利メソッド: デフォルトパラメータを設定して、よく使う操作を簡単に呼び出せるようにする ===
  
  /**
   * 指定した日付の予定を取得
   * @param date 日付 
   */
  async getEventsForDate(date: Date): Promise<ServiceResponse> {
    // 日付の開始と終了を設定
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // ISO形式の文字列に変換
    const timeMin = startOfDay.toISOString();
    const timeMax = endOfDay.toISOString();
    
    logger.info(`${date.toLocaleDateString()}の予定を取得しています`);
    
    // list_eventsツールを実行
    return this.execute('list_events', {
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime'
    });
  }
  
  /**
   * 指定した期間の予定を取得
   * @param startDate 開始日時
   * @param endDate 終了日時
   */
  async getEventsBetweenDates(startDate: Date, endDate: Date): Promise<ServiceResponse> {
    // ISO形式の文字列に変換
    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();
    
    logger.info(`${startDate.toLocaleDateString()} から ${endDate.toLocaleDateString()} までの予定を取得しています`);
    
    // list_eventsツールを実行
    return this.execute('list_events', {
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime'
    });
  }
  
  /**
   * 予定を作成
   * @param title タイトル
   * @param startDateTime 開始日時
   * @param endDateTime 終了日時
   * @param description 説明
   * @param location 場所
   */
  async createEvent(params: {
    title: string;
    startDateTime: Date | string;
    endDateTime: Date | string;
    description?: string;
    location?: string;
  }): Promise<ServiceResponse> {
    // 日付型の場合はISO文字列に変換
    const startDateTime = params.startDateTime instanceof Date 
      ? params.startDateTime.toISOString() 
      : params.startDateTime;
      
    const endDateTime = params.endDateTime instanceof Date 
      ? params.endDateTime.toISOString() 
      : params.endDateTime;
    
    logger.info(`予定「${params.title}」を作成しています`);
    
    // create_eventツールを実行
    return this.execute('create_event', {
      summary: params.title,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
      description: params.description,
      location: params.location
    });
  }
  
  /**
   * 予定を更新
   * @param eventId イベントID
   * @param title タイトル
   * @param startDateTime 開始日時
   * @param endDateTime 終了日時
   * @param description 説明
   * @param location 場所
   */
  async updateEvent(eventId: string, params: {
    title?: string;
    startDateTime?: Date | string;
    endDateTime?: Date | string;
    description?: string;
    location?: string;
  }): Promise<ServiceResponse> {
    // 更新用のデータを準備
    const updateData: any = {};
    
    if (params.title) updateData.summary = params.title;
    
    if (params.startDateTime) {
      // 日付型の場合はISO文字列に変換
      const startDateTime = params.startDateTime instanceof Date 
        ? params.startDateTime.toISOString() 
        : params.startDateTime;
        
      updateData.start = { dateTime: startDateTime };
    }
    
    if (params.endDateTime) {
      // 日付型の場合はISO文字列に変換
      const endDateTime = params.endDateTime instanceof Date 
        ? params.endDateTime.toISOString() 
        : params.endDateTime;
        
      updateData.end = { dateTime: endDateTime };
    }
    
    if (params.description) updateData.description = params.description;
    if (params.location) updateData.location = params.location;
    
    logger.info(`予定ID「${eventId}」を更新しています`);
    
    // update_eventツールを実行
    return this.execute('update_event', {
      eventId,
      ...updateData
    });
  }
  
  /**
   * 予定を削除
   * @param eventId イベントID
   */
  async deleteEvent(eventId: string): Promise<ServiceResponse> {
    logger.info(`予定ID「${eventId}」を削除しています`);
    
    // delete_eventツールを実行
    return this.execute('delete_event', {
      eventId
    });
  }
  
  /**
   * 予定をタイトルで検索
   * @param title 検索するタイトル
   * @param options 検索オプション
   */
  async findEventsByTitle(title: string, options?: {
    timeMin?: Date | string;
    timeMax?: Date | string;
    maxResults?: number;
  }): Promise<ServiceResponse> {
    // 検索クエリのパラメータを準備
    const params: any = {
      q: title,
      orderBy: 'startTime',
      singleEvents: true
    };
    
    // オプションがあれば追加
    if (options) {
      if (options.timeMin) {
        params.timeMin = options.timeMin instanceof Date 
          ? options.timeMin.toISOString() 
          : options.timeMin;
      }
      
      if (options.timeMax) {
        params.timeMax = options.timeMax instanceof Date 
          ? options.timeMax.toISOString() 
          : options.timeMax;
      }
      
      if (options.maxResults) {
        params.maxResults = options.maxResults;
      }
    }
    
    logger.info(`「${title}」を含む予定を検索しています`);
    
    // search_eventsツールを実行
    return this.execute('search_events', params);
  }
}
