/**
 * カレンダーワークフロー用ヘルパー関数
 */

// date-fnsのインポート
import { format, addDays, addWeeks, addMonths, isValid, parse, startOfDay, endOfDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import logger from '../../../utilities/logger';

/**
 * 日時表現の種類
 */
export enum DateTimeExpressionType {
  ABSOLUTE = 'absolute',   // 絶対日時 (2023年4月1日10時など)
  RELATIVE = 'relative',   // 相対日時 (明日、3日後など)
  RECURRENCE = 'recurrence', // 繰り返し (毎週月曜日など)
  DURATION = 'duration',   // 期間 (30分間、2時間など)
}

/**
 * 日付範囲の型定義
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * 自然言語の日付表現をDateオブジェクトに変換する
 * @param dateText 日付表現（「今日」「明日」「4月1日」など）
 * @returns Date オブジェクトまたは null
 */
export function parseDate(dateText: string): Date | null {
  if (!dateText) return null;
  
  const trimmedText = dateText.trim();
  
  // 現在日時
  const now = new Date();
  now.setHours(0, 0, 0, 0); // 日付のみに正規化
  
  // 特定の日付表現
  if (trimmedText === '今日') return now;
  if (trimmedText === '明日') return addDays(now, 1);
  if (trimmedText === '明後日') return addDays(now, 2);
  if (trimmedText === '昨日') return addDays(now, -1);
  if (trimmedText === '一昨日') return addDays(now, -2);
  
  // 「◯日後」「◯日前」表現
  const dayLater = /^(\d+)日後$/.exec(trimmedText);
  if (dayLater) {
    return addDays(now, parseInt(dayLater[1], 10));
  }
  
  const dayBefore = /^(\d+)日前$/.exec(trimmedText);
  if (dayBefore) {
    return addDays(now, -parseInt(dayBefore[1], 10));
  }
  
  // 「◯週間後」「◯週間前」表現
  const weekLater = /^(\d+)週間後$/.exec(trimmedText);
  if (weekLater) {
    return addWeeks(now, parseInt(weekLater[1], 10));
  }
  
  const weekBefore = /^(\d+)週間前$/.exec(trimmedText);
  if (weekBefore) {
    return addWeeks(now, -parseInt(weekBefore[1], 10));
  }
  
  // 「◯ヶ月後」「◯ヶ月前」表現
  const monthLater = /^(\d+)[ヶか]月後$/.exec(trimmedText);
  if (monthLater) {
    return addMonths(now, parseInt(monthLater[1], 10));
  }
  
  const monthBefore = /^(\d+)[ヶか]月前$/.exec(trimmedText);
  if (monthBefore) {
    return addMonths(now, -parseInt(monthBefore[1], 10));
  }
  
  // 曜日表現 (「今週の水曜日」「来週の月曜日」)
  const weekday = /^(今週|来週)の(月|火|水|木|金|土|日)曜日$/.exec(trimmedText);
  if (weekday) {
    const weekOffset = weekday[1] === '来週' ? 1 : 0;
    const weekdays: Record<string, number> = { '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6, '日': 0 };
    const targetDay = weekdays[weekday[2]];
    
    // 現在日時から指定された曜日までの日数を計算
    let resultDate = addWeeks(now, weekOffset);
    const currentDay = resultDate.getDay();
    const daysToAdd = (targetDay - currentDay + 7) % 7;
    
    return addDays(resultDate, daysToAdd);
  }
  
  // 「◯月◯日」表現
  const monthDay = /^(\d{1,2})月(\d{1,2})日$/.exec(trimmedText);
  if (monthDay) {
    const month = parseInt(monthDay[1], 10) - 1; // 0-indexed
    const day = parseInt(monthDay[2], 10);
    
    // 年を判定（過去の日付なら来年と判断）
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const year = (month < currentMonth || (month === currentMonth && day < now.getDate())) 
      ? currentYear + 1 
      : currentYear;
    
    const date = new Date(year, month, day);
    return isValid(date) ? date : null;
  }
  
  // 「YYYY年◯月◯日」表現
  const yearMonthDay = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(trimmedText);
  if (yearMonthDay) {
    const year = parseInt(yearMonthDay[1], 10);
    const month = parseInt(yearMonthDay[2], 10) - 1; // 0-indexed
    const day = parseInt(yearMonthDay[3], 10);
    
    const date = new Date(year, month, day);
    return isValid(date) ? date : null;
  }
  
  // 「YYYY/MM/DD」表現
  const iso = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmedText);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10) - 1; // 0-indexed
    const day = parseInt(iso[3], 10);
    
    const date = new Date(year, month, day);
    return isValid(date) ? date : null;
  }
  
  // 他の形式はnullを返す
  logger.debug("未対応の日付形式: " + trimmedText);
  return null;
}

/**
 * 時間表現を分単位に変換する
 * @param durationText 時間表現（「30分」「1時間」「1時間30分」など）
 * @returns ミリ秒単位の時間、解析失敗時はnull
 */
export function parseDuration(durationText: string): number | null {
  if (!durationText) return null;
  
  const trimmedText = durationText.trim();
  
  // 「X時間Y分」形式
  const hourMinute = /^(\d+)時間(?:(\d+)分)?$/.exec(trimmedText);
  if (hourMinute) {
    const hours = parseInt(hourMinute[1], 10) || 0;
    const minutes = parseInt(hourMinute[2] || '0', 10);
    return (hours * 60 + minutes) * 60 * 1000; // ミリ秒に変換
  }
  
  // 「X分」形式
  const minute = /^(\d+)分$/.exec(trimmedText);
  if (minute) {
    const minutes = parseInt(minute[1], 10);
    return minutes * 60 * 1000; // ミリ秒に変換
  }
  
  // 「X時間」形式
  const hour = /^(\d+)時間$/.exec(trimmedText);
  if (hour) {
    const hours = parseInt(hour[1], 10);
    return hours * 60 * 60 * 1000; // ミリ秒に変換
  }
  
  // 数値のみの場合は「時間」とみなす
  const numeric = /^(\d+)$/.exec(trimmedText);
  if (numeric) {
    const hours = parseInt(numeric[1], 10);
    return hours * 60 * 60 * 1000; // ミリ秒に変換
  }
  
  // 「X.Y時間」形式
  const decimalHour = /^(\d+(?:\.\d+)?)時間$/.exec(trimmedText);
  if (decimalHour) {
    const hours = parseFloat(decimalHour[1]);
    return Math.round(hours * 60 * 60 * 1000); // ミリ秒に変換（小数点以下を四捨五入）
  }
  
  // 解析失敗
  logger.debug("未対応の時間形式: " + trimmedText);
  return null;
}

/**
 * 日付を「2023年4月7日(月)」のようなフォーマットに整形
 * @param date 日付
 * @returns フォーマットされた日付文字列
 */
export function formatDate(date: Date): string {
  // @ts-ignore TypeScriptの型チェックを抑制（date-fnsのバージョン差異対応）
  return format(date, 'yyyy年M月d日(E)', ja);
}

/**
 * 時間を「13:00」のようなフォーマットに整形
 * @param date 日時
 * @returns フォーマットされた時間文字列
 */
export function formatTime(date: Date): string {
  // @ts-ignore TypeScriptの型チェックを抑制（date-fnsのバージョン差異対応）
  return format(date, 'HH:mm', ja);
}

/**
 * 時間範囲を「13:00〜14:30」のようなフォーマットに整形
 * @param start 開始日時
 * @param end 終了日時
 * @returns フォーマットされた時間範囲文字列
 */
export function formatTimeRange(start: Date, end: Date): string {
  return formatTime(start) + "〜" + formatTime(end);
}

/**
 * 日付時間範囲を「2023/4/7 13:00〜14:30」のようなフォーマットに整形
 * @param start 開始日時
 * @param end 終了日時
 * @returns フォーマットされた日付時間範囲文字列
 */
export function formatDateTimeRange(start: Date, end: Date): string {
  if (start.toDateString() === end.toDateString()) {
    // 同じ日の場合は日付を1回だけ表示
    return formatDate(start) + " " + formatTimeRange(start, end);
  } else {
    // 異なる日の場合は両方の日付を表示
    return formatDate(start) + " " + formatTime(start) + "〜" + formatDate(end) + " " + formatTime(end);
  }
}

/**
 * 指定された日付の開始時刻（0時0分0秒）を取得
 * @param date 日付
 * @returns 開始時刻
 */
export function getStartOfDay(date: Date): Date {
  return startOfDay(date);
}

/**
 * 指定された日付の終了時刻（23時59分59秒）を取得
 * @param date 日付
 * @returns 終了時刻
 */
export function getEndOfDay(date: Date): Date {
  return endOfDay(date);
}

/**
 * 予定の配列を整形して文字列に変換
 * @param events 予定の配列
 * @param date 日付（タイトルに使用）
 * @returns フォーマットされた予定一覧
 */
export function formatCalendarEvents(events: any[], date?: Date): string {
  if (!events || events.length === 0) {
    return date 
      ? formatDate(date) + "の予定はありません。"
      : "予定はありません。";
  }
  
  const dateStr = date ? formatDate(date) + "の予定:\n\n" : "予定一覧:\n\n";
  let message = dateStr;
  
  events.forEach((event, index) => {
    // イベントのスタート・エンド時間をDate型に変換（文字列の場合）
    const start = event.start instanceof Date ? event.start : new Date(event.start);
    const end = event.end instanceof Date ? event.end : new Date(event.end);
    
    message += (index + 1) + ". " + (event.title || event.summary) + "\n";
    message += "   時間: " + formatTimeRange(start, end) + "\n";
    
    if (event.location) {
      message += "   場所: " + event.location + "\n";
    }
    
    if (event.description) {
      // 説明が長すぎる場合は省略
      const desc = event.description.length > 100 
        ? event.description.substring(0, 97) + "..." 
        : event.description;
      message += "   説明: " + desc + "\n";
    }
    
    message += "\n";
  });
  
  return message;
}

/**
 * 予定の詳細を整形して文字列に変換
 * @param event 予定
 * @returns フォーマットされた予定詳細
 */
export function formatCalendarEventDetail(event: any): string {
  if (!event) {
    return "予定が見つかりません。";
  }
  
  // イベントのスタート・エンド時間をDate型に変換（文字列の場合）
  const start = event.start instanceof Date ? event.start : new Date(event.start);
  const end = event.end instanceof Date ? event.end : new Date(event.end);
  
  let message = "【予定詳細】\n";
  message += "タイトル: " + (event.title || event.summary) + "\n";
  message += "日時: " + formatDateTimeRange(start, end) + "\n";
  
  if (event.location) {
    message += "場所: " + event.location + "\n";
  }
  
  if (event.description) {
    message += "説明: " + event.description + "\n";
  }
  
  if (event.attendees && event.attendees.length > 0) {
    message += "参加者: " + event.attendees.map((a: any) => a.email || a.name).join(", ") + "\n";
  }
  
  if (event.id) {
    message += "ID: " + event.id + "\n";
  }
  
  return message;
}