"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// OpenAI APIとの連携を行うサービス
const openai_1 = __importDefault(require("openai"));
const env_1 = require("../config/env");
const logger_1 = __importDefault(require("../utilities/logger"));
class OpenAIService {
    constructor() {
        this.openai = new openai_1.default({
            apiKey: env_1.env.OPENAI_API_KEY,
        });
    }
    /**
     * OpenAI APIを使用してテキスト生成を行う
     * @param {string} prompt - ユーザーからの入力メッセージ
     * @param {Array<ConversationMessage>} history - 会話履歴
     * @returns {Promise<string>} AIからの応答
     */
    generateResponse(prompt_1) {
        return __awaiter(this, arguments, void 0, function* (prompt, history = []) {
            try {
                logger_1.default.debug(`OpenAI APIリクエスト開始: ${prompt.substring(0, 50)}...`);
                // システムプロンプト
                const systemPrompt = "あなたはAI少年「gakuβ（ガクベー）」です。ユーザーからの質問にノリと勢いで答えてください。";
                // 会話履歴の最新のメッセージを抽出（最大5件）
                const recentMessages = history
                    .slice(-5)
                    .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
                // APIリクエスト用のメッセージ配列を構築
                const messages = [
                    { role: "system", content: systemPrompt },
                    ...recentMessages,
                    { role: "user", content: prompt }
                ];
                logger_1.default.debug(`OpenAI API送信メッセージ数: ${messages.length}`);
                const response = yield this.openai.chat.completions.create({
                    model: "gpt-4-turbo",
                    messages,
                    temperature: 0.7,
                    max_tokens: 500
                });
                const content = response.choices[0].message.content || '応答を生成できませんでした。';
                logger_1.default.debug(`OpenAI API応答取得完了: ${content.substring(0, 50)}...`);
                return content;
            }
            catch (error) {
                logger_1.default.error('OpenAI API エラー:', error);
                throw new Error('AI応答の生成中にエラーが発生しました');
            }
        });
    }
}
exports.default = new OpenAIService();
