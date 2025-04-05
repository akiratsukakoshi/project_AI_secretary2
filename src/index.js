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
// Discord Bot の基本機能
const discord_js_1 = require("discord.js");
const openai_service_1 = __importDefault(require("./services/openai-service"));
const memory_service_1 = __importDefault(require("./services/memory-service"));
const logger_1 = __importDefault(require("./utilities/logger"));
const env_1 = require("./config/env");
const error_handler_1 = require("./utilities/error-handler");
// グローバルエラーハンドラーのセットアップ
(0, error_handler_1.setupGlobalErrorHandlers)();
// Discord クライアントの初期化
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ]
});
// Bot が準備完了した時のイベント
client.once(discord_js_1.Events.ClientReady, (readyClient) => {
    logger_1.default.info(`Ready! Logged in as ${readyClient.user.tag}`);
});
// メッセージ受信時のイベント
client.on(discord_js_1.Events.MessageCreate, (message) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Bot のメッセージは無視
    if (message.author.bot)
        return;
    // ガクコの呼び出し方法を拡張
    // 1. プレフィックス `!ai`
    // 2. メンション
    // 3. 「ガクコ」という名前を含む
    const isMentioned = message.mentions.users.has(((_a = client.user) === null || _a === void 0 ? void 0 : _a.id) || '');
    const hasPrefix = message.content.startsWith('!ai');
    const hasName = message.content.toLowerCase().includes('ガクコ') ||
        message.content.toLowerCase().includes('がくこ') ||
        message.content.toLowerCase().includes('gakuco');
    if (isMentioned || hasPrefix || hasName) {
        let prompt = message.content;
        // プレフィックスの除去
        if (hasPrefix) {
            prompt = message.content.slice(3).trim();
        }
        // 空のプロンプトチェック
        if (prompt.trim().length === 0) {
            message.reply('こんにちは！AI秘書「ガクコ」です。何かお手伝いできることはありますか？');
            return;
        }
        try {
            // 入力メッセージを会話履歴に追加
            yield memory_service_1.default.addMessage(message.author.id, message.channel.id, {
                role: 'user',
                content: prompt,
                timestamp: new Date()
            });
            // 会話履歴を取得
            const context = yield memory_service_1.default.getConversation(message.author.id, message.channel.id);
            // AIからの応答を取得
            logger_1.default.debug(`ユーザー入力: ${prompt}`);
            const typingMessage = yield message.channel.send('考え中...');
            const aiResponse = yield openai_service_1.default.generateResponse(prompt, context.messages);
            yield typingMessage.delete();
            // 応答を会話履歴に追加
            yield memory_service_1.default.addMessage(message.author.id, message.channel.id, {
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date()
            });
            logger_1.default.debug(`AI応答: ${aiResponse.substring(0, 50)}...`);
            message.reply(aiResponse);
        }
        catch (error) {
            logger_1.default.error('エラーが発生しました:', error);
            message.reply('処理中にエラーが発生しました。もう一度お試しください。');
        }
    }
}));
// Discord Bot ログイン
client.login(env_1.env.DISCORD_TOKEN).catch((error) => {
    logger_1.default.error('Discord ログインエラー:', error);
    process.exit(1);
});
