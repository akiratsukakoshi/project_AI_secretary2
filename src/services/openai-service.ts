// OpenAI APIとの連携を行うサービス
import OpenAI from 'openai';
import { ChatMessage } from '../interfaces/openai';
import { ConversationMessage } from '../interfaces/memory';
import { env } from '../config/env';
import logger from '../utilities/logger';

class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * OpenAI APIを使用してテキスト生成を行う
   * @param {string} prompt - ユーザーからの入力メッセージ
   * @param {Array<ConversationMessage>} history - 会話履歴
   * @returns {Promise<string>} AIからの応答
   */
  async generateResponse(prompt: string, history: ConversationMessage[] = []): Promise<string> {
    try {
      logger.debug(`OpenAI APIリクエスト開始: ${prompt.substring(0, 50)}...`);
      
      // システムプロンプト
      const systemPrompt = "あなたはDiscord上で動作するAI秘書「gaku-co（ガクコ）」です。ユーザーからの質問に丁寧に答え、スケジュール管理やタスク管理をサポートします。";
      
      // 会話履歴の最新のメッセージを抽出（最大5件）
      const recentMessages = history
        .slice(-5)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      // APIリクエスト用のメッセージ配列を構築
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...recentMessages,
        { role: "user", content: prompt }
      ];
      
      logger.debug(`OpenAI API送信メッセージ数: ${messages.length}`);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages,
        temperature: 0.7,
        max_tokens: 500
      });

      const content = response.choices[0].message.content || '応答を生成できませんでした。';
      logger.debug(`OpenAI API応答取得完了: ${content.substring(0, 50)}...`);
      return content;
    } catch (error) {
      logger.error('OpenAI API エラー:', error);
      throw new Error('AI応答の生成中にエラーが発生しました');
    }
  }
}

export default new OpenAIService();