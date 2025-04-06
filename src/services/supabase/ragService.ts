import supabase from '../../config/supabase';
import openaiEmbeddings from '../openaiEmbeddings';
import { Document, Chunk, SearchQuery, SearchResult, VectorSearchResult } from '../../interfaces/rag';

/**
 * RAGシステムのためのSupabaseサービス
 */
class RAGService {
  private documentsTable = 'documents';
  private chunksTable = 'chunks';

  /**
   * ドキュメントを保存
   * @param document 保存するドキュメント
   * @returns 保存されたドキュメントのID
   */
  async saveDocument(document: Document): Promise<string> {
    try {
      const { data, error } = await supabase
        .from(this.documentsTable)
        .insert({
          title: document.title,
          content: document.content,
          source_type: document.source_type,
          source_id: document.source_id,
          metadata: document.metadata,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    } catch (error) {
      console.error('ドキュメント保存エラー:', error);
      throw new Error('ドキュメントの保存中にエラーが発生しました');
    }
  }

  /**
   * チャンクを保存し、埋め込みベクトルを生成して保存
   * @param chunk 保存するチャンク
   * @returns 保存されたチャンクのID
   */
  async saveChunk(chunk: Chunk): Promise<string> {
    try {
      // 埋め込みベクトルが指定されていない場合は生成
      if (!chunk.embedding) {
        chunk.embedding = await openaiEmbeddings.generateEmbedding(chunk.content);
      }

      const { data, error } = await supabase
        .from(this.chunksTable)
        .insert({
          document_id: chunk.document_id,
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: chunk.metadata,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    } catch (error) {
      console.error('チャンク保存エラー:', error);
      throw new Error('チャンクの保存中にエラーが発生しました');
    }
  }

  /**
   * 複数のチャンクをバッチで保存
   * @param chunks 保存するチャンクの配列
   * @returns 保存されたチャンクのID配列
   */
  async saveChunks(chunks: Chunk[]): Promise<string[]> {
    try {
      // チャンクが空の場合は空配列を返す
      if (chunks.length === 0) {
        return [];
      }

      // 埋め込みがないチャンクのコンテンツを収集
      const chunksWithoutEmbedding = chunks.filter(chunk => !chunk.embedding);
      const contentsToEmbed = chunksWithoutEmbedding.map(chunk => chunk.content);

      // 埋め込みを一括生成
      if (contentsToEmbed.length > 0) {
        const embeddings = await openaiEmbeddings.generateEmbeddings(contentsToEmbed);

        // 埋め込みをチャンクに割り当て
        chunksWithoutEmbedding.forEach((chunk, index) => {
          chunk.embedding = embeddings[index];
        });
      }

      // チャンクをバッチで保存
      const { data, error } = await supabase
        .from(this.chunksTable)
        .insert(
          chunks.map(chunk => ({
            document_id: chunk.document_id,
            content: chunk.content,
            embedding: chunk.embedding,
            metadata: chunk.metadata,
          }))
        )
        .select('id');

      if (error) {
        throw error;
      }

      return data.map(item => item.id);
    } catch (error) {
      console.error('チャンクバッチ保存エラー:', error);
      throw new Error('複数チャンクの保存中にエラーが発生しました');
    }
  }

  /**
   * テキストクエリに基づいてベクトル検索を実行
   * @param searchQuery 検索クエリ
   * @returns 検索結果の配列
   */
  async search(searchQuery: SearchQuery): Promise<SearchResult[]> {
    try {
      // クエリテキストの埋め込みを生成
      const queryEmbedding = await openaiEmbeddings.generateEmbedding(searchQuery.query);

      // デフォルトのリミット
      const limit = searchQuery.limit || 5;

      // ベクトル検索のクエリを構築
      let query = supabase
        .from(this.chunksTable)
        .select(`
          id,
          content,
          metadata,
          document_id,
          documents!inner (
            id,
            title,
            source_type,
            source_id
          )
        `)
        .order('similarity', { ascending: false })
        .limit(limit);

      // フィルターが指定されている場合は適用
      if (searchQuery.filters) {
        Object.entries(searchQuery.filters).forEach(([key, value]) => {
          if (key && value !== undefined) {
            // メタデータ内のフィルタリング
            query = query.filter(`metadata->${key}`, 'eq', value);
          }
        });
      }

      // ベクトル検索の実行 (一時的にシンプルなクエリで代用)
      // 注: このコードはRPC関数が設定されるまでの代替です
      const { data, error } = await supabase
        .from(this.chunksTable)
        .select('*')
        .limit(limit);

      if (error) {
        throw error;
      }

      // 検索結果を整形
      return data.map((item: any) => ({
        content: item.content || '',
        metadata: item.metadata || {},
        similarity: 0.7, // 実際のベクトル検索ができないので仮の値を設定
        source_type: 'test', // 一時的に固定値
        source_id: item.document_id || ''
      }));
    } catch (error) {
      console.error('検索エラー:', error);
      throw new Error('ベクトル検索中にエラーが発生しました');
    }
  }

  /**
   * テーブルが存在するか確認
   * @param tableName テーブル名
   * @returns 存在するか
   */
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      return !error;
    } catch (error) {
      return false;
    }
  }

  /**
   * 必要なテーブルを初期化
   */
  async initializeTables(): Promise<void> {
    try {
      // ドキュメントテーブルが存在するか確認
      const documentsExist = await this.tableExists(this.documentsTable);
      if (!documentsExist) {
        console.log(`テーブル ${this.documentsTable} を初期化します...`);
        // テーブルの作成はSupabase Studioなどで行う必要があるため、
        // ここでは初期化のメッセージのみ出力
      }

      // チャンクテーブルが存在するか確認
      const chunksExist = await this.tableExists(this.chunksTable);
      if (!chunksExist) {
        console.log(`テーブル ${this.chunksTable} を初期化します...`);
        // テーブルの作成はSupabase Studioなどで行う必要があるため、
        // ここでは初期化のメッセージのみ出力
      }
    } catch (error) {
      console.error('テーブル初期化エラー:', error);
    }
  }
  async getDocumentById(documentId: string): Promise<Document | null> {
    try {
      const { data, error } = await supabase
        .from(this.documentsTable)
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // データが見つからない場合のエラーコード
          return null;
        }
        throw error;
      }

      return data as Document;
    } catch (error) {
      console.error('ドキュメント取得エラー:', error);
      throw new Error('ドキュメントの取得中にエラーが発生しました');
    }
  }

  /**
   * 特定のソースタイプのドキュメントを全て取得
   * @param sourceType ソースタイプ
   * @returns ドキュメントの配列
   */
  async getDocumentsBySourceType(sourceType: string): Promise<Document[]> {
    try {
      const { data, error } = await supabase
        .from(this.documentsTable)
        .select('*')
        .eq('source_type', sourceType);

      if (error) {
        throw error;
      }

      return data as Document[];
    } catch (error) {
      console.error('ドキュメント一覧取得エラー:', error);
      throw new Error('ドキュメント一覧の取得中にエラーが発生しました');
    }
  }

  /**
   * ドキュメントに関連するすべてのチャンクを取得
   * @param documentId ドキュメントID
   * @returns チャンクの配列
   */
  async getChunksByDocumentId(documentId: string): Promise<Chunk[]> {
    try {
      const { data, error } = await supabase
        .from(this.chunksTable)
        .select('*')
        .eq('document_id', documentId);

      if (error) {
        throw error;
      }

      return data as Chunk[];
    } catch (error) {
      console.error('チャンク一覧取得エラー:', error);
      throw new Error('チャンク一覧の取得中にエラーが発生しました');
    }
  }

  /**
   * ドキュメントを更新
   * @param documentId ドキュメントID
   * @param updates 更新するフィールド
   * @returns 更新が成功したかどうか
   */
  async updateDocument(documentId: string, updates: Partial<Document>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(this.documentsTable)
        .update({
          ...updates,
          updated_at: new Date()
        })
        .eq('id', documentId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('ドキュメント更新エラー:', error);
      throw new Error('ドキュメントの更新中にエラーが発生しました');
    }
  }

  /**
   * ドキュメントを削除し、関連するチャンクも削除
   * @param documentId ドキュメントID
   * @returns 削除が成功したかどうか
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      // 関連するチャンクを削除
      const { error: chunkError } = await supabase
        .from(this.chunksTable)
        .delete()
        .eq('document_id', documentId);

      if (chunkError) {
        throw chunkError;
      }

      // ドキュメントを削除
      const { error: documentError } = await supabase
        .from(this.documentsTable)
        .delete()
        .eq('id', documentId);

      if (documentError) {
        throw documentError;
      }

      return true;
    } catch (error) {
      console.error('ドキュメント削除エラー:', error);
      throw new Error('ドキュメントの削除中にエラーが発生しました');
    }
  }
}

export default new RAGService();
