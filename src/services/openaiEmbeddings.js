"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = require("openai");
const dotenv = __importStar(require("dotenv"));
// 環境変数をロード
dotenv.config();
class OpenAIEmbeddingsService {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API キーが設定されていません');
        }
        this.openai = new openai_1.OpenAI({
            apiKey,
        });
        // デフォルトで最新の埋め込みモデルを使用
        this.embeddingModel = 'text-embedding-3-small';
    }
    /**
     * テキストの埋め込みベクトルを生成
     * @param text 埋め込みを生成するテキスト
     * @returns 埋め込みベクトル
     */
    async generateEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: this.embeddingModel,
                input: text.trim()
            });
            return response.data[0].embedding;
        }
        catch (error) {
            console.error('埋め込み生成エラー:', error);
            throw new Error('テキストの埋め込み生成中にエラーが発生しました');
        }
    }
    /**
     * 複数のテキストに対する埋め込みベクトルをバッチ処理で生成
     * @param texts 埋め込みを生成するテキストの配列
     * @returns 埋め込みベクトルの配列
     */
    async generateEmbeddings(texts) {
        try {
            // 空の文字列を除去
            const validTexts = texts.filter(text => text.trim().length > 0);
            if (validTexts.length === 0) {
                return [];
            }
            const response = await this.openai.embeddings.create({
                model: this.embeddingModel,
                input: validTexts.map(text => text.trim())
            });
            // レスポンスから埋め込みを取得して順序を保持
            return response.data.sort((a, b) => a.index - b.index).map(item => item.embedding);
        }
        catch (error) {
            console.error('バッチ埋め込み生成エラー:', error);
            throw new Error('複数テキストの埋め込み生成中にエラーが発生しました');
        }
    }
    /**
     * 埋め込みモデルを設定
     * @param modelName 使用する埋め込みモデル名
     */
    setEmbeddingModel(modelName) {
        this.embeddingModel = modelName;
    }
}
exports.default = new OpenAIEmbeddingsService();
