export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationContext {
  userId: string;
  channelId: string;
  messages: ConversationMessage[];
  summary?: string;
}

export interface MemoryService {
  addMessage(userId: string, channelId: string, message: ConversationMessage): Promise<void>;
  getConversation(userId: string, channelId: string): Promise<ConversationContext>;
  summarizeConversation(context: ConversationContext): Promise<string>;
  clearConversation(userId: string, channelId: string): Promise<void>;
}