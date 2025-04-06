import { Message } from 'discord.js';
import retriever from './retriever';
import promptBuilder from './promptBuilder';
import queryProcessor from './query/queryProcessor';
import logger from '../../utilities/logger';
import openaiService from '../../services/openai-service';
import memoryService from '../../services/memory-service';

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
      // クエリのトリガータイプを検出
      const triggerType = queryProcessor.detectTriggerType(content);
      
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
      
      // トリガータイプに基づいて処理を分岐
      switch (triggerType) {
        case 'rag':
          // フィルターを検出
          const filters = queryProcessor.detectSearchFilters(cleanQuery);
          
          logger.info('RAGによる検索: "' + cleanQuery + '"');
          
          // 検索とプロンプト構築
          const searchPrompt = await promptBuilder.searchAndBuildPrompt(cleanQuery, filters, userName);
          
          // 検索結果を取得（メタデータ付きで）
          searchResults = await retriever.search(cleanQuery, filters);
          
          // RAG応答を生成
          aiResponse = await openaiService.generateResponseWithSystemPrompt(
            searchPrompt[0], // システムプロンプト
            searchPrompt[1], // ユーザープロンプト（検索結果を含む）
            context.messages
          );
          
          usedRag = true;
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
      logger.error('RAG連携処理エラー:', error);
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
