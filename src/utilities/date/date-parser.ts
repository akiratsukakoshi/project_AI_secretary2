import { addDays, addHours, addMinutes, addMonths, addWeeks, format, isValid, parse } from 'date-fns';
import { ja } from 'date-fns/locale';
import { DateTimeExpression, DateTimeExpressionType } from '../../modules/workflows/core/workflow-types';

/**
 * 自然言語の日付表現をDate オブジェクトに変換
 * @param dateText 日付の文字列表現
 * @returns Date オブジェクトまたは null（解析できない場合）
 */
export function parseDate(dateText: string): Date | null {
  if (!dateText) return null;
  
  // 日付表現を正規化（全角→半角、スペース除去など）
  const normalized = dateText
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .trim();
  
  // 現在日時
  const now = new Date();
  
  // === 絶対日付のパターン ===
  
  // ISO形式 (2023-04-01, 2023/04/01)
  let match = normalized.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1; // 0-indexed
    const day = parseInt(match[3]);
    
    const date = new Date(year, month, day);
    if (isValid(date)) {
      return date;
    }
  }
  
  // 年月日パターン (2023年4月1日)
  match = normalized.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1; // 0-indexed
    const day = parseInt(match[3]);
    
    const date = new Date(year, month, day);
    if (isValid(date)) {
      return date;
    }
  }
  
  // 月日パターン (4月1日)
  match = normalized.match(/^(\d{1,2})月\s*(\d{1,2})日$/);
  if (match) {
    const month = parseInt(match[1]) - 1; // 0-indexed
    const day = parseInt(match[2]);
    
    // 年を判定（過去の日付なら来年と判断）
    const currentMonth = now.getMonth();
    const year = (month < currentMonth) ? now.getFullYear() + 1 : now.getFullYear();
    
    const date = new Date(year, month, day);
    if (isValid(date)) {
      return date;
    }
  }
  
  // === 相対日付のパターン ===
  
  // 特定キーワード
  if (/^今日$/.test(normalized)) return new Date();
  if (/^明日$/.test(normalized)) return addDays(now, 1);
  if (/^明後日$/.test(normalized)) return addDays(now, 2);
  if (/^昨日$/.test(normalized)) return addDays(now, -1);
  if (/^一昨日$/.test(normalized)) return addDays(now, -2);
  
  // X日後 / X日前
  match = normalized.match(/^(\d+)日(後|前)$/);
  if (match) {
    const days = parseInt(match[1]);
    return match[2] === '後' ? addDays(now, days) : addDays(now, -days);
  }
  
  // X週間後 / X週間前
  match = normalized.match(/^(\d+)週間(後|前)$/);
  if (match) {
    const weeks = parseInt(match[1]);
    return match[2] === '後' ? addWeeks(now, weeks) : addWeeks(now, -weeks);
  }
  
  // X月後 / X月前
  match = normalized.match(/^(\d+)ヶ月(後|前)$|^(\d+)カ月(後|前)$|^(\d+)か月(後|前)$/);
  if (match) {
    const months = parseInt(match[1] || match[3] || match[5]);
    return match[2] === '後' || match[4] === '後' || match[6] === '後' 
      ? addMonths(now, months) 
      : addMonths(now, -months);
  }
  
  // 今週/来週/先週 + 曜日
  match = normalized.match(/^(今週|来週|先週)の(月|火|水|木|金|土|日)曜日$/);
  if (match) {
    const weekOffset = match[1] === '来週' ? 1 : (match[1] === '先週' ? -1 : 0);
    const weekdays = { '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6, '日': 0 };
    const targetDay = weekdays[match[2] as keyof typeof weekdays];
    
    let resultDate = addWeeks(now, weekOffset);
    const currentDay = resultDate.getDay();
    const daysToAdd = (targetDay - currentDay + 7) % 7;
    return addDays(resultDate, daysToAdd);
  }
  
  // 次の + 曜日
  match = normalized.match(/^次の(月|火|水|木|金|土|日)曜日$/);
  if (match) {
    const weekdays = { '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6, '日': 0 };
    const targetDay = weekdays[match[1] as keyof typeof weekdays];
    const currentDay = now.getDay();
    const daysToAdd = (targetDay - currentDay + 7) % 7;
    return addDays(now, daysToAdd === 0 ? 7 : daysToAdd);
  }
  
  // 解析できない場合
  return null;
}

/**
 * 時間表現を分単位（ミリ秒）に変換する
 * @param durationText 期間の文字列表現
 * @returns ミリ秒単位の期間、または null（解析できない場合）
 */
export function parseDuration(durationText: string): number | null {
  if (!durationText) return null;
  
  // 文字列を正規化
  const normalized = durationText
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .trim();
  
  // 「X時間Y分」形式
  let match = normalized.match(/^(\d+)時間(?:(\d+)分)?$/);
  if (match) {
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2] || '0');
    return (hours * 60 + minutes) * 60 * 1000; // ミリ秒に変換
  }
  
  // 「X分」形式
  match = normalized.match(/^(\d+)分$/);
  if (match) {
    const minutes = parseInt(match[1]);
    return minutes * 60 * 1000; // ミリ秒に変換
  }
  
  // 「X時間」形式
  match = normalized.match(/^(\d+)時間$/);
  if (match) {
    const hours = parseInt(match[1]);
    return hours * 60 * 60 * 1000; // ミリ秒に変換
  }
  
  // 数値のみの場合は「時間」とみなす
  match = normalized.match(/^(\d+)$/);
  if (match) {
    const hours = parseInt(match[1]);
    return hours * 60 * 60 * 1000; // ミリ秒に変換
  }
  
  // 「X.Y時間」形式
  match = normalized.match(/^(\d+(?:\.\d+)?)時間$/);
  if (match) {
    const hours = parseFloat(match[1]);
    return Math.floor(hours * 60 * 60 * 1000); // ミリ秒に変換
  }
  
  return null;
}

/**
 * 日時を特定のフォーマットにフォーマット
 * @param date フォーマットする日付
 * @param formatStr フォーマット文字列
 * @returns フォーマットされた日付文字列
 */
export function formatDateTime(date: Date, formatStr: string = 'yyyy年M月d日(E) HH:mm'): string {
  return format(date, formatStr);
}

/**
 * 日付を「2023年4月7日(金)」のようなフォーマットに整形
 * @param date フォーマットする日付
 * @returns フォーマットされた日付文字列
 */
export function formatDate(date: Date): string {
  return format(date, 'yyyy年M月d日');
}

/**
 * 時間を「13:30」のようなフォーマットに整形
 * @param date フォーマットする日付
 * @returns フォーマットされた時間文字列
 */
export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

/**
 * 時間範囲を「13:00〜14:30」のようなフォーマットに整形
 * @param start 開始時間
 * @param end 終了時間
 * @returns フォーマットされた時間範囲文字列
 */
export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)}〜${formatTime(end)}`;
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
    return `${formatDate(start)} ${formatTime(start)}〜${formatTime(end)}`;
  } else {
    // 異なる日の場合は両方の日付を表示
    return `${formatDate(start)} ${formatTime(start)}〜${formatDate(end)} ${formatTime(end)}`;
  }
}

/**
 * 日時表現を包括的に解析する
 * @param expression 日時表現（「明日の午後3時」「来週の月曜日」など）
 * @returns 解析結果（型、値、元の表現、確信度）
 */
export function analyzeDateTimeExpression(expression: string): DateTimeExpression | null {
  // 日付解析を試みる
  const date = parseDate(expression);
  if (date) {
    return {
      type: DateTimeExpressionType.ABSOLUTE,
      value: date,
      original: expression,
      confidence: 0.9, // 高い確信度
    };
  }
  
  // 期間解析を試みる
  const duration = parseDuration(expression);
  if (duration !== null) {
    return {
      type: DateTimeExpressionType.DURATION,
      value: duration,
      original: expression,
      confidence: 0.9, // 高い確信度
    };
  }
  
  // その他のパターンは今後追加
  // 例: 「毎週月曜日」→ RECURRENCE タイプ
  
  return null;
}
