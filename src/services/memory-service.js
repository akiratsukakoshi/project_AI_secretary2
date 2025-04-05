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
const logger_1 = __importDefault(require("../utilities/logger"));
class MemoryServiceImpl {
    constructor() {
        this.MAX_MESSAGES = 50; // 最大保持メッセージ数
        this.SUMMARY_THRESHOLD = 20; // サマリー化するメッセージ数のしきい値
        this.conversations = new Map();
        logger_1.default.info('メモリサービスを初期化しました');
    }
    getContextKey(userId, channelId) {
        return `${userId}:${channelId}`;
    }
    addMessage(userId, channelId, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = this.getContextKey(userId, channelId);
            if (!this.conversations.has(key)) {
                logger_1.default.debug(`新しい会話コンテキストを作成: ${key}`);
                this.conversations.set(key, {
                    userId,
                    channelId,
                    messages: []
                });
            }
            const context = this.conversations.get(key);
            context.messages.push(message);
            logger_1.default.debug(`メッセージを追加: ${key}, メッセージ数: ${context.messages.length}`);
            // メッセージ数が上限を超えたら古いメッセージを削除
            if (context.messages.length > this.MAX_MESSAGES) {
                // 将来的にはサマリー化するが、現在は単純に削除
                const removedMessages = context.messages.splice(0, context.messages.length - this.MAX_MESSAGES);
                logger_1.default.debug(`古いメッセージを削除: ${removedMessages.length}件`);
            }
            // メッセージ数がしきい値を超えたらサマリー化を検討
            // 現在は実装していないが、将来的に実装予定
            if (context.messages.length >= this.SUMMARY_THRESHOLD && !context.summary) {
                // サマリー化を検討する処理
                // この機能は将来的に実装
            }
        });
    }
    getConversation(userId, channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = this.getContextKey(userId, channelId);
            logger_1.default.debug(`会話コンテキストを取得: ${key}`);
            return this.conversations.get(key) || {
                userId,
                channelId,
                messages: []
            };
        });
    }
    summarizeConversation(context) {
        return __awaiter(this, void 0, void 0, function* () {
            // 将来的に実装
            // 現状では単純なメッセージを返す
            logger_1.default.debug(`会話のサマリー化を実行: ${context.userId}:${context.channelId}`);
            return `${context.messages.length}件のメッセージを含む会話`;
        });
    }
    clearConversation(userId, channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = this.getContextKey(userId, channelId);
            logger_1.default.debug(`会話履歴をクリア: ${key}`);
            this.conversations.delete(key);
        });
    }
}
exports.default = new MemoryServiceImpl();
