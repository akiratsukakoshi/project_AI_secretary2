import { Message } from 'discord.js';
import logger from '../../../utilities/logger';

/**
 * ユーザーからの入力クエリを処理するクラス
 */
class QueryProcessor {
  /**
   * ユーザー入力からクエリを抽出
   * プレフィックス、メンション、トリガーワードなどを除去
   */
  extractQuery(content: string): string {
    // プレフィックスやメンションを除去
    let query = content;
    
    // プレフィックス「\!ai」の除去
    if (query.startsWith('\!ai')) {
      query = query.slice(3).trim();
    }
    
    // メンションを除去（Discord IDパターン）
    query = query.replace(/<@\!?\d+>/g, '').trim();
    
    // 「ガクコ、」などの呼びかけを除去
    query = query.replace(/^(ガクコ|がくこ|gakuco)(、|,|\s+)/i, '').trim();
    
    // 「探して：」「教えて：」などのトリガーワードを除去
    query = query.replace(/^(探して|検索して|教えて|調べて)(：|:|\s+)/i, '').trim();
    
    logger.debug(`元のメッセージ: ${content}`);
    logger.debug(`抽出されたクエリ: ${query}`);
    
    return query;
  }

  /**
   * ユーザー入力からトリガータイプを検出
   * @returns トリガータイプ (rag, workflow, conversation)
   */
  detectTriggerType(content: string): 'rag' | 'workflow' | 'conversation' {
    // RAG検索トリガーの検出
    const hasRagTrigger = content.match(/ガクコ.*探して|検索して|教えて|調べて|ガクコ.*について/i);
    
    // ワークフロートリガーの検出
    const hasWorkflowTrigger = content.match(/ガクコ.*ワークフロー|実行して|設定して|予定|スケジュール/i);
    
    // 明示的なトリガーがなくても、質問形式ならRAG検索を検討
    const isQuestion = content.match(/[?？]$/) || 
                      content.includes('いつ') || 
                      content.includes('どこ') || 
                      content.includes('誰が') || 
                      content.includes('何を') ||
                      content.includes('どんな') ||
                      content.includes('どうやって') ||
                      content.includes('教えて');
    
    // 明示的なRAGトリガーがある場合はRAG
    if (hasRagTrigger) {
      return 'rag';
    }
    
    // 明示的なワークフロートリガーがある場合はワークフロー
    if (hasWorkflowTrigger) {
      return 'workflow';
    }
    
    // 質問形式の場合はRAG
    if (isQuestion) {
      return 'rag';
    }
    
    // それ以外は通常の会話
    return 'conversation';
  }

  /**
   * ユーザーの質問を解析して検索フィルターを抽出
   */
  detectSearchFilters(query: string): Record<string, any> {
    const filters: Record<string, any> = {};
    
    // 日付フィルターの検出
    const dateMatch = query.match(/(今日|明日|昨日|今週|先週|来週|(\d+)月(\d+)日)/);
    if (dateMatch) {
      filters.date = this.parseDate(dateMatch[0]);
    }
    
    // システム情報の検出
    if (query.includes('できること') || 
        query.includes('ワークフロー') || 
        query.includes('使い方') || 
        query.includes('ガクコ') || 
        query.includes('がくこ') || 
        query.includes('機能')) {
      filters.type = 'system_info';
    }
    
    // イベント情報の検出
    if (query.includes('イベント') || 
        query.includes('プログラム') || 
        query.includes('セミナー') ||
        query.includes('講座') ||
        query.includes('ワークショップ')) {
      filters.type = 'event';
    }
    
    // 会議情報の検出
    if (query.includes('会議') || 
        query.includes('ミーティング') || 
        query.includes('打ち合わせ') ||
        query.includes('議事録')) {
      filters.type = 'meeting_note';
    }
    
    // 顧客情報の検出
    if (query.includes('顧客') || 
        query.includes('お客様') || 
        query.includes('参加者') ||
        query.includes('アレルギー')) {
      filters.type = 'customer';
    }
    
    logger.debug('検出されたフィルター: ' + JSON.stringify(filters));
    
    return filters;
  }

  /**
   * 日付文字列をDate型に変換
   */
  private parseDate(dateStr: string): Date {
    const now = new Date();
    
    if (dateStr === '今日') {
      return now;
    }
    
    if (dateStr === '明日') {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return tomorrow;
    }
    
    if (dateStr === '昨日') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return yesterday;
    }
    
    if (dateStr === '今週') {
      return now;
    }
    
    if (dateStr === '来週') {
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      return nextWeek;
    }
    
    if (dateStr === '先週') {
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      return lastWeek;
    }
    
    // X月Y日のパターン
    const monthDayMatch = dateStr.match(/(\d+)月(\d+)日/);
    if (monthDayMatch) {
      const month = parseInt(monthDayMatch[1]) - 1; // JavaScriptの月は0始まり
      const day = parseInt(monthDayMatch[2]);
      
      const date = new Date(now.getFullYear(), month, day);
      
      // 指定された日付が過去の場合、来年の同じ日付と解釈
      if (date < now && (month < now.getMonth() || (month === now.getMonth() && day < now.getDate()))) {
        date.setFullYear(now.getFullYear() + 1);
      }
      
      return date;
    }
    
    // パターンに一致しない場合は現在日時を返す
    return now;
  }

  /**
   * ユーザー名を取得
   */
  getUserName(message: Message): string {
    if (message.member?.nickname) {
      return message.member.nickname;
    }
    return message.author.username;
  }
}

export default new QueryProcessor();
