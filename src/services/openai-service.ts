// OpenAI APIとの連携を行うサービス
import OpenAI from 'openai';
import { ChatMessage } from '../interfaces/openai';
import { ConversationMessage } from '../interfaces/memory';
import { env } from '../config/env';
import logger from '../utilities/logger';
import configLoader from '../utilities/config-loader';

class OpenAIService {
  private openai: OpenAI;
  private botConfig: any;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    
    // ボット設定の読み込み
    try {
      this.botConfig = configLoader.getBotConfig();
      logger.info('ボット設定を読み込みました');
    } catch (error) {
      logger.error('ボット設定の読み込みに失敗しました。デフォルト設定を使用します。', error);
      this.botConfig = {
        system_prompt: "あなたはDiscord上で動作するAI秘書「gaku-co（ガクコ）」です。ユーザーからの質問に丁寧に答え、スケジュール管理やタスク管理をサポートします。"
      };
    }
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
      
      // 外部化されたシステムプロンプトを使用
      const systemPrompt = this.botConfig.system_prompt;
      
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
        messages: messages as any,
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

  /**
   * カスタムシステムプロンプトを使用してレスポンスを生成
   * @param {string} systemPrompt - カスタムシステムプロンプト
   * @param {string} userPrompt - ユーザープロンプト（RAG検索結果など）
   * @param {Array<ConversationMessage>} history - 会話履歴
   * @returns {Promise<string>} AIからの応答
   */
  async generateResponseWithSystemPrompt(
    systemPrompt: string,
    userPrompt: string,
    history: ConversationMessage[] = []
  ): Promise<string> {
    try {
      logger.debug(`OpenAI APIカスタムシステムプロンプトリクエスト開始: ${userPrompt.substring(0, 50)}...`);
      
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
        { role: "user", content: userPrompt }
      ];
      
      logger.debug(`OpenAI API送信メッセージ数: ${messages.length}`);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 800  // RAG応答はより長い可能性があるため、トークン上限を拡大
      });

      const content = response.choices[0].message.content || '応答を生成できませんでした。';
      logger.debug(`OpenAI API応答取得完了: ${content.substring(0, 50)}...`);
      return content;
    } catch (error) {
      logger.error('OpenAI API エラー:', error);
      throw new Error('AI応答の生成中にエラーが発生しました');
    }
  }

  /**
   * テキストを埋め込みベクトルに変換
   * @param {string} text - 変換するテキスト
   * @returns {Promise<number[]>} 埋め込みベクトル
   */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      logger.debug(`テキスト埋め込み生成開始: ${text.substring(0, 30)}...`);
      
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.replace(/\n/g, " "),
        encoding_format: "float"
      });

      logger.debug('テキスト埋め込み生成完了');
      return response.data[0].embedding;
    } catch (error) {
      logger.error('テキスト埋め込み生成エラー:', error);
      throw new Error('テキスト埋め込み生成中にエラーが発生しました');
    }
  }
}

export default new OpenAIService();