import supabase from '../../config/supabase';
import { Chunk, Document, SearchQuery, SearchResult } from '../../interfaces/rag';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import openaiEmbeddings from '../openaiEmbeddings';

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
  async saveChunks(chunks: Chunk[]): Promise<boolean> {
    if (!chunks || chunks.length === 0) {
      console.warn('保存するチャンクがありません');
      return true;
    }
    
    try {
      console.log(`${chunks.length}個のチャンクに埋め込みを生成して保存します...`);
      
      // チャンクの内容から埋め込みを生成
      const chunkContents = chunks.map(chunk => chunk.content);
      const embeddings = await openaiEmbeddings.generateEmbeddings(chunkContents);
      
      // 埋め込みをチャンクに追加
      for (let i = 0; i < chunks.length; i++) {
        chunks[i].embedding = embeddings[i];
      }
      
      // チャンクをバッチで挿入
      // 注意: 実際のエラーを見ながら実装方法を調整できる
      for (const chunk of chunks) {
        const { error } = await supabase
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
    } catch (error) {
      console.error('チャンクのバッチ保存エラー:', error);
      throw new Error('チャンクのバッチ保存に失敗しました');
    }
  }
  
  /**
   * 検索クエリを実行する（ベクトル検索）
   * @param query 検索クエリ
   * @returns 検索結果の配列
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    console.log("\n\n=================================================================");
    console.log("🔴🔴🔴 RAGService.search() が発動しました 🔴🔴🔴");
    console.log("=================================================================\n\n");
    console.log(`検索クエリ: "${query.query}"${query.filters ? ` (フィルター: ${JSON.stringify(query.filters)})` : ''}`)
    
    try {
      // クエリテキストの埋め込みを生成
      console.log('検索クエリの埋め込みベクトルを生成中...')
      const queryEmbedding = await openaiEmbeddings.generateEmbedding(query.query);
      console.log('埋め込みベクトル生成完了:', queryEmbedding?.length || 0, '次元');
      
      // ベクトル検索のパラメータ
      const threshold = 0.5; // 類似度閾値 0.7→0.5に下げて、より広い範囲の検索結果を取得
      const limit = query.limit || 5; // 取得する結果数
      
      console.log('ベクトル検索を実行中...')
      console.log('検索パラメータ:', { threshold, limit });
      
      try {
        // RPC関数を使用したベクトル検索を実行
        console.log('\n🚀🚀🚀 Supabase RPC "match_chunks" を呼び出します 🚀🚀🚀');
        console.log('パラメータ:');
        console.log('- query_embedding: [埋め込みベクトル]', queryEmbedding.length, '次元');
        console.log('- match_threshold:', threshold);
        console.log('- match_count:', limit);
        
        // 実行時間計測開始
        const startTime = Date.now();
        
        const { data, error } = await supabase.rpc('match_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit
        });
        
        // 実行時間計測終了
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        console.log(`\n🚀 Supabase RPC 呼び出し完了（実行時間: ${executionTime}ms）`);
        
        if (error) {
          console.error('❌ ベクトル検索エラー:', error);
          console.error('エラーコード:', error.code);
          console.error('エラーメッセージ:', error.message);
          console.error('ヒント:', error.hint || 'なし');
          console.error('詳細:', error.details || 'なし');
          console.log('キーワード検索にフォールバック...');
          return this.fallbackSearch(query);
        }

        console.log('Supabase RPC 呼び出し成功, 結果:', data ? `${data.length}件` : '0件');

        // ベクトル検索結果のログ出力
        if (data && data.length > 0) {
          console.log("\n🔍 ベクトル検索結果:");
          data.forEach((item: any, idx: number) => {
            console.log(
              `${idx + 1}. [${item.similarity?.toFixed(3)}] ${item.content?.slice(0, 40)}...`
            );
          });
        }
        
        // 検索結果がない場合は空配列を返す
        if (!data || data.length === 0) {
          console.log('ベクトル検索で結果が見つかりませんでした');
          return this.fallbackSearch(query);
        }
        
        console.log(`ベクトル検索で ${data.length} 件の結果が見つかりました`);
        
        // 検索結果を整形
        const results: SearchResult[] = [];
        for (const item of data) {
          // ドキュメント情報を取得
          const { data: docData, error: docError } = await supabase
            .from('documents')
            .select('title, source_type, source_id')
            .eq('id', item.document_id)
            .single();
          
          if (docError) {
            console.error('ドキュメント取得エラー:', docError);
            continue;
          }
          
          results.push({
            content: item.content,
            metadata: item.metadata,
            similarity: item.similarity,
            source_type: docData?.source_type,
            source_id: docData?.source_id
          });
        }
        
        return results;
      } catch (error) {
        console.error('ベクトル検索実行エラー:', error);
        console.log('キーワード検索にフォールバック...');
        return this.fallbackSearch(query);
      }
    } catch (error) {
      console.error('検索エラー:', error);
      throw new Error('検索中にエラーが発生しました');
    }
  }
  
  /**
   * フォールバック検索（キーワードベース）
   * @param query 検索クエリ
   * @returns 検索結果の配列
   */
  private async fallbackSearch(query: SearchQuery): Promise<SearchResult[]> {
    try {
      console.log('キーワード検索を実行中...');
      
      // シンプルなキーワード検索
      const { data, error } = await supabase
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
        console.error('キーワード検索エラー:', error);
        throw error;
      }
      
      // 検索結果がない場合は空配列を返す
      if (!data || data.length === 0) {
        console.log('キーワード検索でも結果が見つかりませんでした');
        return [];
      }
      
      console.log(`キーワード検索で ${data.length} 件の結果が見つかりました`);
      
      // 検索結果を整形
      return data.map(item => {
        // ドキュメント情報からソースタイプとソースIDを取得
        // itemとdocumentsの存在確認をしっかり行う
        let sourceType: string | undefined = undefined;
        let sourceId: string | undefined = undefined;
        
        if (item && item.documents) {
          const docs = item.documents as any;
          if (docs) {
            sourceType = docs.source_type;
            sourceId = docs.source_id;
          }
        }
        
        return {
          content: item.content,
          metadata: item.metadata,
          similarity: 1.0, // 仮の類似度（フォールバック）
          source_type: sourceType,
          source_id: sourceId
        };
      });
    } catch (error) {
      console.error('フォールバック検索エラー:', error);
      throw new Error('検索中にエラーが発生しました');
    }
  }
  
  /**
   * ドキュメントIDに基づいてチャンクを取得
   * @param documentId ドキュメントID
   * @returns チャンクの配列
   */
  async getChunksByDocumentId(documentId: string): Promise<Chunk[]> {
    try {
      const { data, error } = await supabase
        .from('chunks')
        .select('*')
        .eq('document_id', documentId);
      
      if (error) {
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error(`ドキュメント ${documentId} のチャンク取得エラー:`, error);
      throw new Error('チャンクの取得に失敗しました');
    }
  }
  
  /**
   * ドキュメントIDに基づいてチャンクを削除
   * @param documentId ドキュメントID
   * @returns 削除が成功したかどうか
   */
  async deleteChunksByDocumentId(documentId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chunks')
        .delete()
        .eq('document_id', documentId);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error(`ドキュメント ${documentId} のチャンク削除エラー:`, error);
      return false;
    }
  }
  
  /**
   * ドキュメントを保存
   * @param document 保存するドキュメント
   * @returns 生成されたドキュメントID
   */
  async saveDocument(document: Document): Promise<string> {
    try {
      // document.idがない場合はUUIDを生成
      const docId = document.id || uuidv4();
      
      // ドキュメント情報をSupabaseに保存
      const { data, error } = await supabase
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
    } catch (error) {
      console.error('ドキュメント保存エラー:', error);
      throw new Error('ドキュメントの保存に失敗しました');
    }
  }
  
  /**
   * チャンクを保存
   * @param chunk 保存するチャンク
   * @returns 生成されたチャンクID
   */
  async saveChunk(chunk: Chunk): Promise<string> {
    try {
      // チャンクIDを設定
      const chunkId = chunk.id || uuidv4();
      
      // 埋め込みがない場合は生成
      if (!chunk.embedding) {
        console.log('チャンクの埋め込みを生成しています...');
        chunk.embedding = await openaiEmbeddings.generateEmbedding(chunk.content);
      }
      
      // チャンク情報をSupabaseに保存
      const { data, error } = await supabase
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
    } catch (error) {
      console.error('チャンク保存エラー:', error);
      throw new Error('チャンクの保存に失敗しました');
    }
  }
  
  /**
   * ドキュメントを削除（関連するチャンクも削除）
   * @param documentId 削除するドキュメントID
   * @returns 削除が成功したかどうか
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      // まず関連するチャンクを削除
      await this.deleteChunksByDocumentId(documentId);
      
      // ドキュメントを削除
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error(`ドキュメント ${documentId} 削除エラー:`, error);
      return false;
    }
  }
  
  /**
   * 必要なテーブルが存在することを確認（初期化）
   * @returns 初期化が成功したかどうか
   */
  async initializeTables(): Promise<boolean> {
    try {
      // テーブルが存在するか確認するだけのシンプルなクエリ
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('id')
        .limit(1);
      
      const { data: chunkData, error: chunkError } = await supabase
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
    } catch (error) {
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
  async rebuildEmbeddings(batchSize: number = 10, limit?: number): Promise<number> {
    try {
      console.log('埋め込みベクトルが欠落しているチャンクを検索しています...');
      
      // embeddingがnullのチャンクを検索
      const { data, error } = await supabase
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
        const embeddings = await openaiEmbeddings.generateEmbeddings(contents);
        
        // 各チャンクを更新
        for (let j = 0; j < batch.length; j++) {
          const { error: updateError } = await supabase
            .from('chunks')
            .update({ 
              embedding: embeddings[j],
              updated_at: new Date().toISOString()
            })
            .eq('id', batch[j].id);
          
          if (updateError) {
            console.error(`チャンク ${batch[j].id} の埋め込み更新エラー:`, updateError);
          } else {
            processedCount++;
          }
        }
        
        console.log(`進捗: ${processedCount}/${chunks.length} (${Math.round(processedCount / chunks.length * 100)}%)`);
      }
      
      console.log(`${processedCount}個のチャンクの埋め込みを再構築しました`);
      return processedCount;
    } catch (error) {
      console.error('埋め込み再構築エラー:', error);
      throw new Error('埋め込みの再構築中にエラーが発生しました');
    }
  }
}

// シングルトンインスタンスをエクスポート
export default new RAGService();
