import { ConversationContext, ConversationMessage, MemoryService } from '../interfaces/memory';
import logger from '../utilities/logger';

class MemoryServiceImpl implements MemoryService {
  private conversations: Map<string, ConversationContext>;
  private readonly MAX_MESSAGES = 50; // 最大保持メッセージ数
  private readonly SUMMARY_THRESHOLD = 20; // サマリー化するメッセージ数のしきい値
  
  constructor() {
    this.conversations = new Map();
    logger.info('メモリサービスを初期化しました');
  }
  
  private getContextKey(userId: string, channelId: string): string {
    return `${userId}:${channelId}`;
  }
  
  async addMessage(userId: string, channelId: string, message: ConversationMessage): Promise<void> {
    const key = this.getContextKey(userId, channelId);
    
    if (!this.conversations.has(key)) {
      logger.debug(`新しい会話コンテキストを作成: ${key}`);
      this.conversations.set(key, {
        userId,
        channelId,
        messages: []
      });
    }
    
    const context = this.conversations.get(key) as ConversationContext;
    context.messages.push(message);
    logger.debug(`メッセージを追加: ${key}, メッセージ数: ${context.messages.length}`);
    
    // メッセージ数が上限を超えたら古いメッセージを削除
    if (context.messages.length > this.MAX_MESSAGES) {
      // 将来的にはサマリー化するが、現在は単純に削除
      const removedMessages = context.messages.splice(0, context.messages.length - this.MAX_MESSAGES);
      logger.debug(`古いメッセージを削除: ${removedMessages.length}件`);
    }
    
    // メッセージ数がしきい値を超えたらサマリー化を検討
    // 現在は実装していないが、将来的に実装予定
    if (context.messages.length >= this.SUMMARY_THRESHOLD && !context.summary) {
      // サマリー化を検討する処理
      // この機能は将来的に実装
    }
  }
  
  async getConversation(userId: string, channelId: string): Promise<ConversationContext> {
    const key = this.getContextKey(userId, channelId);
    logger.debug(`会話コンテキストを取得: ${key}`);
    
    return this.conversations.get(key) || {
      userId,
      channelId,
      messages: []
    };
  }
  
  async summarizeConversation(context: ConversationContext): Promise<string> {
    // 将来的に実装
    // 現状では単純なメッセージを返す
    logger.debug(`会話のサマリー化を実行: ${context.userId}:${context.channelId}`);
    return `${context.messages.length}件のメッセージを含む会話`;
  }
  
  async clearConversation(userId: string, channelId: string): Promise<void> {
    const key = this.getContextKey(userId, channelId);
    logger.debug(`会話履歴をクリア: ${key}`);
    this.conversations.delete(key);
  }
}

export default new MemoryServiceImpl();