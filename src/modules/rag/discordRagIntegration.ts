import { Message } from 'discord.js';
import retriever from './retriever';
import promptBuilder from './promptBuilder';
import queryProcessor from './query/queryProcessor';
import logger from '../../utilities/logger';
import openaiService from '../../services/openai-service';
import memoryService from '../../services/memory-service';

// デバッグログ：モジュール読み込み確認
console.log('📢📢📢 discordRagIntegration モジュールが読み込まれました');
logger.debug('discordRagIntegration モジュールが読み込まれました');

/**
 * DiscordBotとRAGシステムを統合するクラス
 */
class DiscordRagIntegration {
  /**
   * Discord Bot メッセージに対してRAG対応で処理
   * @param message Discord.js Message オブジェクト
   * @param content メッセージ内容
   * @returns 処理結果
   */
  async processMessage(message: Message, content: string): Promise<{
    response: string;
    usedRag: boolean;
    searchResults?: any[];
  }> {
    try {
      // デバッグログ：processMessage開始
      console.log('\n🌟🌟🌟 discordRagIntegration.processMessage が呼び出されました 🌟🌟🌟');
      console.log(`content: "${content}"`);
      logger.debug(`discordRagIntegration.processMessage が呼び出されました: "${content}"`);
      
      // クエリのトリガータイプを検出
      console.log('\n🔍 queryProcessor.detectTriggerType を呼び出します...');
      const triggerType = queryProcessor.detectTriggerType(content);
      console.log(`\n🔍🔍🔍 検出されたトリガータイプ: ${triggerType} (クエリ: "${content.substring(0, 30)}...")`);
      logger.info(`検出されたトリガータイプ: ${triggerType} (クエリ: "${content.substring(0, 50)}...")`);
      
      // スタックトレースの出力
      console.log('呼び出し元スタックトレース:');
      console.log(new Error().stack);
      
      // クエリを抽出（トリガーワードなどを削除）
      const cleanQuery = queryProcessor.extractQuery(content);
      
      // ユーザー名を取得
      const userName = queryProcessor.getUserName(message);
      
      // RAGを使用するかどうかのフラグ
      let usedRag = false;
      let searchResults: any[] = [];
      
      // 会話履歴を会話コンテキストに追加
      await memoryService.addMessage(
        message.author.id,
        message.channel.id,
        {
          role: 'user',
          content: cleanQuery,
          timestamp: new Date()
        }
      );
      
      // 会話コンテキストを取得
      const context = await memoryService.getConversation(
        message.author.id,
        message.channel.id
      );
      
      let aiResponse: string;
      
      // デバッグログ追加：トリガータイプに基づく分岐直前
      console.log("\n🔄🔄🔄 トリガータイプに基づく処理分岐開始 🔄🔄🔄");
      console.log(`triggerType = "${triggerType}", cleanQuery = "${cleanQuery}"`);
      logger.debug(`トリガータイプに基づく処理分岐開始: triggerType = "${triggerType}", cleanQuery = "${cleanQuery}"`);
      
      // テスト強制RAG分岐
      const forceRag = content.includes('強制RAG') || content.includes('記憶');
      if (forceRag) {
        console.log('⚠️ 強制的にRAGモードで処理します（テスト用）');
        const forcedTriggerType = 'rag';
        
        // フィルターを検出
        const filters = queryProcessor.detectSearchFilters(cleanQuery);
        
        logger.info('【強制】RAGによる検索: "' + cleanQuery + '"');
        console.log('\n\n🔎🔎🔎 【強制】RAG検索を開始します 🔎🔎🔎');
        console.log('検出フィルター:', JSON.stringify(filters));
        
        try {
          // デバッグログ追加：retriever.search呼び出し直前
          console.log('\n👉👉👉 【強制】retriever.search()呼び出し直前 👈👈👈');
          
          // 検索実行
          console.time('RAG検索実行時間');
          searchResults = await retriever.search(cleanQuery, filters);
          console.timeEnd('RAG検索実行時間');
          console.log(`🔎 検索結果: ${searchResults.length}件取得しました`);
          
          // 検索とプロンプト構築
          console.log('🔎 検索結果を使用してプロンプトを構築します...');
          const searchPrompt = await promptBuilder.buildRAGPrompt(cleanQuery, searchResults, userName);
          
          // RAG応答を生成
          console.log('🔎 OpenAIにRAGプロンプトを送信して応答を生成します...');
          aiResponse = await openaiService.generateResponseWithSystemPrompt(
            searchPrompt[0], // システムプロンプト
            searchPrompt[1], // ユーザープロンプト（検索結果を含む）
            context.messages
          );
          
          usedRag = true;
          console.log('✅ 【強制】RAG処理完了 - 応答生成成功');
        } catch (error) {
          console.error('❌ 【強制】RAG検索中にエラーが発生しました:', error);
          
          // エラー時は通常の会話として処理
          console.log('通常の会話処理にフォールバックします');
          aiResponse = await openaiService.generateResponse(cleanQuery, context.messages);
        }
      } else {
        // トリガータイプに基づいて処理を分岐
        switch (triggerType) {
          case 'rag':
            // フィルターを検出
            const filters = queryProcessor.detectSearchFilters(cleanQuery);
            
            logger.info('RAGによる検索: "' + cleanQuery + '"');
            logger.info(`RAGタイプ検出: トリガー="${triggerType}", クエリ="${cleanQuery}"`);
            console.log('\n\n🔎🔎🔎 RAG検索を開始します 🔎🔎🔎');
            console.log('検出フィルター:', JSON.stringify(filters));
            
            // デバッグログ追加: 検出フィルターの詳細情報
            console.log('🔍🔍🔍 検出フィルター詳細情報(DiscordRAG) 🔍🔍🔍');
            console.log('filters.source_type:', filters.source_type);
            console.log('フィルタータイプ:', typeof filters.source_type);
            console.log('フィルター完全値:', JSON.stringify(filters));
            
            try {
              // デバッグログ追加：retriever.search呼び出し直前
              console.log('\n👉👉👉 retriever.search()呼び出し直前 👈👈👈');
              logger.debug('retriever.search()呼び出し直前');
              
              // 検索結果を取得（メタデータ付きで）
              console.log('🔎 retriever.search() を呼び出します...');
              console.log('検索クエリ:', cleanQuery);
              console.log('フィルター:', filters);
              
              // 検索実行
              console.time('RAG検索実行時間');
              searchResults = await retriever.search(cleanQuery, filters);
              console.timeEnd('RAG検索実行時間');
              console.log(`🔎 検索結果: ${searchResults.length}件取得しました`);
              
              // デバッグログ追加：retriever.search呼び出し直後
              console.log('\n👉👉👉 retriever.search()呼び出し完了 👈👈👈');
              logger.debug(`retriever.search()呼び出し完了: ${searchResults.length}件の結果`);
              
              if (searchResults.length > 0) {
                console.log('最初の検索結果サンプル:', 
                  JSON.stringify(searchResults[0]).substring(0, 200) + '...');
              } else {
                console.log('検索結果が0件でした');
              }
              
              // 検索とプロンプト構築
              console.log('🔎 検索結果を使用してプロンプトを構築します...');
              const searchPrompt = await promptBuilder.buildRAGPrompt(cleanQuery, searchResults, userName);
              
              // RAG応答を生成
              console.log('🔎 OpenAIにRAGプロンプトを送信して応答を生成します...');
              aiResponse = await openaiService.generateResponseWithSystemPrompt(
                searchPrompt[0], // システムプロンプト
                searchPrompt[1], // ユーザープロンプト（検索結果を含む）
                context.messages
              );
              
              usedRag = true;
              console.log('✅ RAG処理完了 - 応答生成成功');
            } catch (error) {
              // デバッグログ追加：RAG検索エラー詳細
              console.error('❌ RAG検索中にエラーが発生しました:', error);
              console.error('エラータイプ:', typeof error);
              console.error('エラーメッセージ:', error instanceof Error ? error.message : 'メッセージなし');
              console.error('エラースタック:', error instanceof Error ? error.stack : 'スタックなし');
              logger.error(`RAG検索中にエラー発生: ${error instanceof Error ? error.message : String(error)}`);
              
              // エラー時は通常の会話として処理
              console.log('通常の会話処理にフォールバックします');
              aiResponse = await openaiService.generateResponse(cleanQuery, context.messages);
            }
            break;
            
          case 'workflow':
            // TODO: ワークフローモジュールとの連携
            // 現段階では通常の会話として扱う
            logger.info('ワークフローリクエスト: "' + cleanQuery + '" (未実装なのでLLMで会話として処理)');
            
            aiResponse = await openaiService.generateResponse(cleanQuery, context.messages);
            break;
            
          case 'conversation':
          default:
            // 通常の会話
            logger.info('通常の会話: "' + cleanQuery + '"');
            
            aiResponse = await openaiService.generateResponse(cleanQuery, context.messages);
            break;
        }
      }
      
      // デバッグログ追加：処理分岐完了
      console.log("\n🔄🔄🔄 トリガータイプに基づく処理分岐完了 🔄🔄🔄");
      console.log(`triggerType = "${triggerType}", usedRag = ${usedRag}`);
      logger.debug(`トリガータイプに基づく処理分岐完了: triggerType = "${triggerType}", usedRag = ${usedRag}`);
      
      // 応答を会話コンテキストに追加
      await memoryService.addMessage(
        message.author.id,
        message.channel.id,
        {
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date()
        }
      );
      
      return {
        response: aiResponse,
        usedRag,
        searchResults: usedRag ? searchResults : undefined
      };
    } catch (error) {
      // デバッグログ追加：全体的なエラー詳細
      console.error('❌❌❌ RAG連携処理全体でエラー発生:', error);
      console.error('エラータイプ:', typeof error);
      console.error('エラーメッセージ:', error instanceof Error ? error.message : 'メッセージなし');
      console.error('エラースタック:', error instanceof Error ? error.stack : 'スタックなし');
      logger.error(`RAG連携処理エラー: ${error instanceof Error ? error.message : String(error)}`);
      
      throw new Error('RAGを用いた回答生成中にエラーが発生しました');
    }
  }
  
  /**
   * ユーザーのメッセージにRAGフィードバックボタンを付与するか判断
   * @param usedRag RAGが使用されたかどうか
   * @returns フィードバックボタンを付与するかどうか
   */
  shouldAddFeedbackButtons(usedRag: boolean): boolean {
    // RAGを使用した場合のみフィードバックを収集
    return usedRag;
  }
}

export default new DiscordRagIntegration();
