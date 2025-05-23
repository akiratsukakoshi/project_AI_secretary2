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
    console.log("\n🧠 クエリタイプ判定開始:", content);
    logger.info("クエリタイプ判定開始: " + content);

    // デバッグログを強化
    console.log("\n🎯🎯🎯 detectTriggerType メソッドが呼び出されました 🎯🎯🎯");
    console.log("入力内容完全版:", content);
    logger.debug("detectTriggerType メソッドが呼び出されました: " + content);

    // すべてのパターンマッチングを表示するデバッグコード
    console.log("\n📝 パターンマッチングデバッグ 📝");
    console.log("「記憶を確認」マッチ:", content.includes('記憶を確認') ? "はい" : "いいえ");
    console.log("「記憶」マッチ:", content.includes('記憶') ? "はい" : "いいえ");
    console.log("「議事録」マッチ:", content.includes('議事録') ? "はい" : "いいえ");
    console.log("「会議」マッチ:", content.includes('会議') ? "はい" : "いいえ");
    console.log("入力文字列小文字:", content.toLowerCase());

    // 明示的なデバッグログ追加：判定開始
    console.log("\n🔎🔎🔎 クエリタイプ判定プロセス詳細 🔎🔎🔎");
    logger.debug("クエリタイプ判定プロセス詳細開始");
    
    // 明示的RAGキーワード - 最も優先度の高いシンプルなチェック（単一キーワード）
    const simpleKeywords = ['記憶', '議事録', '会議', 'ミーティング', '履歴', '検索'];
    let foundKeyword = null;
    for (const keyword of simpleKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        foundKeyword = keyword;
        break;
      }
    }
    
    if (foundKeyword) {
      console.log(`✅ シンプルRAGキーワード検出: "${foundKeyword}"`);
      logger.info(`【シンプルRAGキーワード検出】: "${foundKeyword}"`);
      logger.info(`クエリタイプ判定結果: rag（"${foundKeyword}"キーワード）`);
      return 'rag';
    }
    
    // 明示的なRAG起動トリガーワード（最優先）
    // パターンを拡張: 「記憶を確認」の後の「して」なども考慮
    const hasExplicitRagTrigger = content.match(/ガクコ.*記憶を確認|ガクコ.*データを確認|ガクコ.*記録確認|記憶を確認して|記憶を確認|データを確認|記録確認|情報を確認|情報を探|検索して|履歴を確認|過去の.*を確認|議事録|会議.*議事録|会議.*記録/i);
    
    // デバッグログ追加：明示的RAGトリガー
    console.log('明示的RAGトリガー条件チェック結果:', hasExplicitRagTrigger ? 
      `マッチ: "${hasExplicitRagTrigger[0]}"` : "マッチなし");
    logger.debug('明示的RAGトリガー条件チェック: ' + (hasExplicitRagTrigger ? 
      `マッチ: "${hasExplicitRagTrigger[0]}"` : "マッチなし"));
    
    if (hasExplicitRagTrigger) {
      console.log("✅ 明示的RAGトリガー検出:", hasExplicitRagTrigger[0]);
      logger.info("【明示的RAGトリガー検出】: " + hasExplicitRagTrigger[0]);
      logger.info("クエリタイプ判定結果: rag（明示的トリガー）");
      return 'rag';
    }

    // 追加: 記憶・会議特化のチェック
    const hasMemoryMeetingKeywords = content.match(/記憶|会議|議事録|ミーティング|打ち合わせ/i);
    console.log('記憶・会議キーワード:', hasMemoryMeetingKeywords ? 
      `マッチ: "${hasMemoryMeetingKeywords[0]}"` : "マッチなし");
    
    if (hasMemoryMeetingKeywords) {
      console.log("✅ 記憶・会議キーワード検出:", hasMemoryMeetingKeywords[0]);
      logger.info("【記憶・会議キーワード検出】: " + hasMemoryMeetingKeywords[0]);
      logger.info("クエリタイプ判定結果: rag（記憶・会議キーワード）");
      return 'rag';
    }

    // 明示的なRAG検索トリガーの検出（命令形も含める）
    const hasRagTrigger = content.match(/ガクコ.*探して|検索して|調べて|ガクコ.*について|検索|教えて.*情報|調査|確認して|教えて|知りたい|共有して/i);
    console.log("- RAGトリガー検出:", hasRagTrigger ? `あり: "${hasRagTrigger[0]}"` : "なし");
    logger.info("RAGトリガー検出: " + (hasRagTrigger ? `あり: "${hasRagTrigger[0]}"` : "なし"));
    
    // 明示的なワークフロートリガーの検出
    const hasWorkflowTrigger = content.match(/ガクコ.*ワークフロー|ワークフロー実行|タスク管理|タスク追加|カレンダー|予定管理|スケジュール設定/i);
    console.log("- ワークフロートリガー検出:", hasWorkflowTrigger ? `あり: "${hasWorkflowTrigger[0]}"` : "なし");
    logger.info("ワークフロートリガー検出: " + (hasWorkflowTrigger ? `あり: "${hasWorkflowTrigger[0]}"` : "なし"));
    
    // 質問形式を判定（質問文のみRAG検索とする、一般的な単語は対象外に）
    const isQuestion = content.match(/[?？]$/) || 
                      (content.includes('いつ') && !content.includes('予定')) || 
                      (content.includes('どこ') && !content.includes('タスク')) || 
                      (content.includes('誰が') && !content.includes('担当')) || 
                      (content.includes('何を') && !content.includes('タスク')) ||
                      content.includes('どんな') ||
                      content.includes('どうすれば') ||
                      (content.includes('教えて') && !content.includes('タスク'));
                      
    // デバッグログ追加：質問形式チェック詳細
    console.log("- 質問形式チェック詳細:");
    console.log("  - 末尾が?/？:", content.match(/[?？]$/) ? "はい" : "いいえ");
    console.log("  - 「いつ」含む:", content.includes('いつ') ? "はい" : "いいえ");
    console.log("  - 「どこ」含む:", content.includes('どこ') ? "はい" : "いいえ");
    console.log("  - 「誰が」含む:", content.includes('誰が') ? "はい" : "いいえ");
    console.log("  - 「何を」含む:", content.includes('何を') ? "はい" : "いいえ");
    console.log("  - 「どんな」含む:", content.includes('どんな') ? "はい" : "いいえ");
    console.log("  - 「どうすれば」含む:", content.includes('どうすれば') ? "はい" : "いいえ");
    console.log("  - 「教えて」含む:", content.includes('教えて') ? "はい" : "いいえ");
    
    console.log("- 質問形式判定:", isQuestion ? "質問形式" : "質問形式ではない");
    logger.info("質問形式判定: " + (isQuestion ? "質問形式" : "質問形式ではない"));

    // 会議やミーティング関連のキーワードを検出
    // 「確認」と「会議」の両方を含むフレーズは会議情報検索の要求と判断
    const confirmMeeting = 
      (content.includes('確認') || content.includes('教えて') || content.includes('調べて') || content.includes('わかる')) && 
      (content.includes('会議') || content.includes('ミーティング') || content.includes('打ち合わせ') || 
       content.includes('議事録') || content.includes('打合せ') || content.includes('MTG'));
    
    // 会議関連キーワード
    const hasMeetingKeywords = content.includes('会議') || 
                               content.includes('ミーティング') || 
                               content.includes('打ち合わせ') ||
                               content.includes('打合せ') ||
                               content.includes('MTG') ||
                               content.includes('議事録');
                               
    // デバッグログ追加：会議キーワード詳細
    console.log("- 会議キーワード詳細:");
    console.log("  - 「会議」含む:", content.includes('会議') ? "はい" : "いいえ");
    console.log("  - 「ミーティング」含む:", content.includes('ミーティング') ? "はい" : "いいえ");
    console.log("  - 「打ち合わせ」含む:", content.includes('打ち合わせ') ? "はい" : "いいえ");
    console.log("  - 「議事録」含む:", content.includes('議事録') ? "はい" : "いいえ");
    console.log("  - 「確認」含む:", content.includes('確認') ? "はい" : "いいえ");
    
    console.log("- 会議関連キーワード:", hasMeetingKeywords ? "あり" : "なし");
    console.log("- 会議確認フレーズ:", confirmMeeting ? "あり" : "なし");
    logger.info(`会議関連キーワード: ${hasMeetingKeywords ? "あり" : "なし"}, 会議確認フレーズ: ${confirmMeeting ? "あり" : "なし"}`);
    
    // 詳細な判定プロセスをログに出力
    if (hasMeetingKeywords) {
      logger.info(`会議関連キーワード検出: ${content}`);
    }
    
    if (confirmMeeting) {
      logger.info(`会議確認フレーズ検出: ${content}`);
    }
    
    // 日付関連のキーワードを検出
    const hasDateKeywords = content.match(/(\d+)月(\d+)日|今日|明日|昨日|先日|先週|今週|来週/);
    console.log("- 日付キーワード:", hasDateKeywords ? `あり (${hasDateKeywords[0]})` : "なし");
    
    // タスク関連キーワード
    const hasTaskKeywords = content.toLowerCase().includes('タスク') || 
                            content.toLowerCase().includes('todo') || 
                            content.toLowerCase().includes('やること') ||
                            content.toLowerCase().includes('予定');
    console.log("- タスク関連キーワード:", hasTaskKeywords ? "あり" : "なし");
    
    // デバッグログ追加：判定プロセスのまとめ
    console.log("\n🧩 判定プロセスのまとめ:");
    console.log(`- 明示的RAGトリガー: ${hasExplicitRagTrigger ? "あり" : "なし"}`);
    console.log(`- RAGトリガー: ${hasRagTrigger ? "あり" : "なし"}`);
    console.log(`- ワークフロートリガー: ${hasWorkflowTrigger ? "あり" : "なし"}`);
    console.log(`- 質問形式: ${isQuestion ? "はい" : "いいえ"}`);
    console.log(`- 会議関連キーワード: ${hasMeetingKeywords ? "あり" : "なし"}`);
    console.log(`- 会議確認フレーズ: ${confirmMeeting ? "あり" : "なし"}`);
    console.log(`- 日付キーワード: ${hasDateKeywords ? "あり" : "なし"}`);
    console.log(`- タスク関連キーワード: ${hasTaskKeywords ? "あり" : "なし"}`);
    
    // 判定プロセスが完了したら、最終的な判定結果を出力
    // ワークフロートリガーがある場合は、それを優先
    if (hasWorkflowTrigger) {
      console.log("✅ クエリタイプ判定結果: workflow（ワークフロートリガー検出）");
      logger.info("クエリタイプ判定結果: workflow（ワークフロートリガー検出）");
      return 'workflow';
    }

    // 日付+タスク関連キーワードがある場合はワークフロー
    if (hasDateKeywords && hasTaskKeywords) {
      console.log("✅ クエリタイプ判定結果: workflow（日付+タスク関連キーワード検出）");
      logger.info("クエリタイプ判定結果: workflow（日付+タスク関連キーワード検出）");
      return 'workflow';
    }

    // 会議＋日付キーワードがある場合もワークフロー
    if (hasMeetingKeywords && hasDateKeywords) {
      console.log("✅ クエリタイプ判定結果: rag（会議+日付キーワード検出）");
      logger.info("クエリタイプ判定結果: rag（会議+日付キーワード検出）");
      return 'rag';
    }

    // 会議情報の確認要求はRAG検索
    if (confirmMeeting) {
      console.log("✅ クエリタイプ判定結果: rag（会議情報確認要求）");
      logger.info("クエリタイプ判定結果: rag（会議情報確認要求）");
      return 'rag';
    }

    // RAGトリガーがある場合
    if (hasRagTrigger) {
      console.log("✅ クエリタイプ判定結果: rag（RAGトリガー検出）");
      logger.info("クエリタイプ判定結果: rag（RAGトリガー検出）");
      return 'rag';
    }

    // 質問文の場合はRAG検索
    if (isQuestion) {
      console.log("✅ クエリタイプ判定結果: rag（質問形式検出）");
      logger.info("クエリタイプ判定結果: rag（質問形式検出）");
      return 'rag';
    }

    // どれにも当てはまらない場合は会話モード
    console.log("✅ クエリタイプ判定結果: conversation（デフォルト）");
    logger.info("クエリタイプ判定結果: conversation（デフォルト）");
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
        query.includes('機能') ||
        query.includes('ガクコ') ||
        query.includes('gaku-co')) {
      filters.source_type = 'system_info';
    }
    
    // イベント情報の検出
    if (query.includes('イベント') || 
        query.includes('プログラム') || 
        query.includes('企画')) {
      filters.source_type = 'event';
    }
    
    // 会議情報の検出
    if (query.includes('会議') || 
        query.includes('ミーティング') || 
        query.includes('打ち合わせ') ||
        query.includes('議事録')) {
      filters.source_type = 'meeting_note';
    }
    
    // 顧客情報の検出
    if (query.includes('顧客') || 
        query.includes('アレルギー') || 
        query.includes('参加者')) {
      filters.source_type = 'customer';
    }
    
    // 組織情報の検出
    if (query.includes('原っぱ大学') || 
        query.includes('組織') || 
        query.includes('スタッフ') ||
        query.includes('チーム') ||
        query.includes('メンバー') ||
        query.includes('部署') ||
        query.includes('職員') ||
        query.includes('教員')) {
      // 組織情報の場合は値を明示的に設定
      filters.source_type = 'organization_info';
      
      // デバッグログ追加: 組織情報検出の詳細
      console.log('🏢🏢🏢 組織情報フィルター検出(QueryProcessor) 🏢🏢🏢');
      console.log('検出条件に一致:', 
        query.includes('原っぱ大学') ? '原っぱ大学' : 
        query.includes('組織') ? '組織' : 
        query.includes('スタッフ') ? 'スタッフ' : 
        query.includes('チーム') ? 'チーム' : 
        query.includes('メンバー') ? 'メンバー' : 
        query.includes('部署') ? '部署' : 
        query.includes('職員') ? '職員' : 
        query.includes('教員') ? '教員' : '不明');
      console.log('設定されたfilters.source_type:', filters.source_type);
    }
    
    // その他情報の検出
    if (query.includes('ニュース') || 
        query.includes('知識')) {
      filters.source_type = 'other_information';
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
