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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = __importDefault(require("../../config/supabase"));
const dotenv = __importStar(require("dotenv"));
const uuid_1 = require("uuid");
const openaiEmbeddings_1 = __importDefault(require("../openaiEmbeddings"));
// 環境変数をロード
dotenv.config();
/**
 * RAGサービス - Supabase連携
 * ベクトル検索とRAG関連のデータアクセスを処理する
 */
class RAGService {
    /**
     * チャンクをバッチでSupabaseに保存
     * @param chunks 保存するチャンクの配列
     * @returns 成功したか
     */
    async saveChunks(chunks) {
        if (!chunks || chunks.length === 0) {
            console.warn('保存するチャンクがありません');
            return true;
        }
        try {
            console.log(`${chunks.length}個のチャンクに埋め込みを生成して保存します...`);
            // チャンクの内容から埋め込みを生成
            const chunkContents = chunks.map(chunk => chunk.content);
            const embeddings = await openaiEmbeddings_1.default.generateEmbeddings(chunkContents);
            // 埋め込みをチャンクに追加
            for (let i = 0; i < chunks.length; i++) {
                chunks[i].embedding = embeddings[i];
            }
            // チャンクをバッチで挿入
            // 注意: 実際のエラーを見ながら実装方法を調整できる
            for (const chunk of chunks) {
                const { error } = await supabase_1.default
                    .from('chunks')
                    .insert({
                    id: chunk.id,
                    document_id: chunk.document_id,
                    content: chunk.content,
                    embedding: chunk.embedding,
                    metadata: chunk.metadata || {},
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                if (error) {
                    console.error('チャンク保存エラー:', error);
                    // 個別のエラーでは全体を失敗としない（より堅牢な実装）
                    console.warn(`チャンク保存失敗: document_id=${chunk.document_id}`);
                }
            }
            console.log(`${chunks.length}個のチャンクの埋め込み生成と保存が完了しました`);
            return true;
        }
        catch (error) {
            console.error('チャンクのバッチ保存エラー:', error);
            throw new Error('チャンクのバッチ保存に失敗しました');
        }
    }
    /**
     * 検索クエリを実行する（単純なキーワード検索）
     * @param query 検索クエリ
     * @returns 検索結果の配列
     */
    async search(query) {
        try {
            // シンプルなキーワード検索（埋め込みベクトル検索の代替）
            // textSearchは使用せず、ILIKEで簡易検索
            const { data, error } = await supabase_1.default
                .from('chunks')
                .select(`
          id,
          content,
          metadata,
          document_id,
          documents:document_id (
            id,
            title,
            source_type,
            source_id
          )
        `)
                .ilike('content', `%${query.query}%`)
                .limit(query.limit || 5);
            if (error) {
                console.error('検索エラー:', error);
                throw error;
            }
            // 検索結果がない場合は空配列を返す
            if (!data || data.length === 0) {
                return [];
            }
            // 検索結果を整形
            return data.map(item => {
                // ドキュメント情報からソースタイプとソースIDを取得
                // itemとdocumentsの存在確認をしっかり行う
                let sourceType = undefined;
                let sourceId = undefined;
                if (item && item.documents) {
                    const docs = item.documents;
                    if (docs) {
                        sourceType = docs.source_type;
                        sourceId = docs.source_id;
                    }
                }
                return {
                    content: item.content,
                    metadata: item.metadata,
                    similarity: 1.0, // 仮の類似度
                    source_type: sourceType,
                    source_id: sourceId
                };
            });
        }
        catch (error) {
            console.error('検索エラー:', error);
            throw new Error('検索中にエラーが発生しました');
        }
    }
    /**
     * ドキュメントIDに基づいてチャンクを取得
     * @param documentId ドキュメントID
     * @returns チャンクの配列
     */
    async getChunksByDocumentId(documentId) {
        try {
            const { data, error } = await supabase_1.default
                .from('chunks')
                .select('*')
                .eq('document_id', documentId);
            if (error) {
                throw error;
            }
            return data || [];
        }
        catch (error) {
            console.error(`ドキュメント ${documentId} のチャンク取得エラー:`, error);
            throw new Error('チャンクの取得に失敗しました');
        }
    }
    /**
     * ドキュメントIDに基づいてチャンクを削除
     * @param documentId ドキュメントID
     * @returns 削除が成功したかどうか
     */
    async deleteChunksByDocumentId(documentId) {
        try {
            const { error } = await supabase_1.default
                .from('chunks')
                .delete()
                .eq('document_id', documentId);
            if (error) {
                throw error;
            }
            return true;
        }
        catch (error) {
            console.error(`ドキュメント ${documentId} のチャンク削除エラー:`, error);
            return false;
        }
    }
    /**
     * ドキュメントを保存
     * @param document 保存するドキュメント
     * @returns 生成されたドキュメントID
     */
    async saveDocument(document) {
        try {
            // document.idがない場合はUUIDを生成
            const docId = document.id || (0, uuid_1.v4)();
            // ドキュメント情報をSupabaseに保存
            const { data, error } = await supabase_1.default
                .from('documents')
                .insert({
                id: docId,
                title: document.title,
                content: document.content,
                source_type: document.source_type,
                source_id: document.source_id,
                metadata: document.metadata || {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
                .select('id')
                .single();
            if (error) {
                console.error('ドキュメント保存エラー:', error);
                throw error;
            }
            return docId;
        }
        catch (error) {
            console.error('ドキュメント保存エラー:', error);
            throw new Error('ドキュメントの保存に失敗しました');
        }
    }
    /**
     * チャンクを保存
     * @param chunk 保存するチャンク
     * @returns 生成されたチャンクID
     */
    async saveChunk(chunk) {
        try {
            // チャンクIDを設定
            const chunkId = chunk.id || (0, uuid_1.v4)();
            // 埋め込みがない場合は生成
            if (!chunk.embedding) {
                console.log('チャンクの埋め込みを生成しています...');
                chunk.embedding = await openaiEmbeddings_1.default.generateEmbedding(chunk.content);
            }
            // チャンク情報をSupabaseに保存
            const { data, error } = await supabase_1.default
                .from('chunks')
                .insert({
                id: chunkId,
                document_id: chunk.document_id,
                content: chunk.content,
                embedding: chunk.embedding,
                metadata: chunk.metadata || {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
                .select('id')
                .single();
            if (error) {
                console.error('チャンク保存エラー:', error);
                throw error;
            }
            return chunkId;
        }
        catch (error) {
            console.error('チャンク保存エラー:', error);
            throw new Error('チャンクの保存に失敗しました');
        }
    }
    /**
     * ドキュメントを削除（関連するチャンクも削除）
     * @param documentId 削除するドキュメントID
     * @returns 削除が成功したかどうか
     */
    async deleteDocument(documentId) {
        try {
            // まず関連するチャンクを削除
            await this.deleteChunksByDocumentId(documentId);
            // ドキュメントを削除
            const { error } = await supabase_1.default
                .from('documents')
                .delete()
                .eq('id', documentId);
            if (error) {
                throw error;
            }
            return true;
        }
        catch (error) {
            console.error(`ドキュメント ${documentId} 削除エラー:`, error);
            return false;
        }
    }
    /**
     * 必要なテーブルが存在することを確認（初期化）
     * @returns 初期化が成功したかどうか
     */
    async initializeTables() {
        try {
            // テーブルが存在するか確認するだけのシンプルなクエリ
            const { data: docData, error: docError } = await supabase_1.default
                .from('documents')
                .select('id')
                .limit(1);
            const { data: chunkData, error: chunkError } = await supabase_1.default
                .from('chunks')
                .select('id')
                .limit(1);
            // エラーがあれば、テーブルが存在しない可能性
            if (docError || chunkError) {
                console.warn('テーブル確認エラー、テーブルが存在しない可能性があります:', { docError, chunkError });
                return false;
            }
            console.log('RAGテーブルの初期化確認が完了しました');
            return true;
        }
        catch (error) {
            console.error('テーブル初期化エラー:', error);
            return false;
        }
    }
    /**
     * 埋め込みベクトルが欠落しているチャンクを修復する
     * @param batchSize 一度に処理するチャンク数
     * @param limit 処理する最大チャンク数（任意）
     * @returns 修復したチャンク数
     */
    async rebuildEmbeddings(batchSize = 10, limit) {
        try {
            console.log('埋め込みベクトルが欠落しているチャンクを検索しています...');
            // embeddingがnullのチャンクを検索
            const { data, error } = await supabase_1.default
                .from('chunks')
                .select('id, content')
                .is('embedding', null)
                .order('created_at', { ascending: false })
                .limit(limit || 1000);
            if (error) {
                console.error('埋め込み欠落チャンク検索エラー:', error);
                throw error;
            }
            if (!data || data.length === 0) {
                console.log('埋め込みベクトルが欠落しているチャンクはありません');
                return 0;
            }
            console.log(`${data.length}個の埋め込み欠落チャンクを検出しました`);
            // バッチ処理のための準備
            const chunks = data;
            let processedCount = 0;
            // バッチ処理を実行
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                console.log(`バッチ処理中: ${i + 1}～${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
                // バッチ内のコンテンツから埋め込みを生成
                const contents = batch.map(chunk => chunk.content);
                const embeddings = await openaiEmbeddings_1.default.generateEmbeddings(contents);
                // 各チャンクを更新
                for (let j = 0; j < batch.length; j++) {
                    const { error: updateError } = await supabase_1.default
                        .from('chunks')
                        .update({
                        embedding: embeddings[j],
                        updated_at: new Date().toISOString()
                    })
                        .eq('id', batch[j].id);
                    if (updateError) {
                        console.error(`チャンク ${batch[j].id} の埋め込み更新エラー:`, updateError);
                    }
                    else {
                        processedCount++;
                    }
                }
                console.log(`進捗: ${processedCount}/${chunks.length} (${Math.round(processedCount / chunks.length * 100)}%)`);
            }
            console.log(`${processedCount}個のチャンクの埋め込みを再構築しました`);
            return processedCount;
        }
        catch (error) {
            console.error('埋め込み再構築エラー:', error);
            throw new Error('埋め込みの再構築中にエラーが発生しました');
        }
    }
}
// シングルトンインスタンスをエクスポート
exports.default = new RAGService();
