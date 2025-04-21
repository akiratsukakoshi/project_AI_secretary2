import supabase from '../../config/supabase';
import { Chunk, Document, SearchQuery, SearchResult } from '../../interfaces/rag';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import openaiEmbeddings from '../openaiEmbeddings';

// 環境変数をロード
dotenv.config();

/**
 * 拡張検索クエリインターフェース
 */
interface EnhancedSearchQuery extends SearchQuery {
  keyword?: string;
  tags?: string[];
  useContext?: boolean;
  contextCount?: number;
  filter?: {
    source_type?: string;
  };
}

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
      // フィルター情報をより詳細に出力
      if (query.filters) {
        console.log('🔍🔍🔍 検索フィルター詳細情報(RAGService.search) 🔍🔍🔍');
        console.log('filters:', JSON.stringify(query.filters));
        console.log('filters.source_type:', query.filters.source_type);
        console.log('フィルタータイプ:', typeof query.filters.source_type);
      }
      
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
        // ソースタイプフィルターを明示的に取得（undefinedの場合はnullに）
        const sourceTypeFilter = query.filters?.source_type || null;
        console.log('設定するsource_typeフィルター:', sourceTypeFilter);
        
        // RPC関数を使用したベクトル検索を実行
        console.log('\n🚀🚀🚀 Supabase RPC "match_chunks_enhanced" を呼び出します 🚀🚀🚀');
        console.log('パラメータ:');
        console.log('- query_embedding: [埋め込みベクトル]', queryEmbedding.length, '次元');
        console.log('- match_threshold:', threshold);
        console.log('- match_count:', limit);
        console.log('- filter_source_type:', sourceTypeFilter);
        
        // 実行時間計測開始
        const startTime = Date.now();
        
        // 重要: ここで確実に match_chunks_enhanced を呼び出す
        const rpcParams = {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit,
          filter_source_type: sourceTypeFilter
        };
        
        console.log('最終的なRPCパラメータ:', JSON.stringify(rpcParams));
        
        // RPC関数呼び出しを明示的に match_chunks_enhanced に固定
        const { data, error } = await supabase.rpc('match_chunks_enhanced', rpcParams);
        
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
          
          // エラーが22000の場合は別のRPC関数を試す
          if (error.code === '22000' || error.message.includes('dimensions')) {
            console.log('エンベディング次元数エラー。標準のmatch_chunksを試します...');
            
            const fallbackRpcParams = {
              query_embedding: queryEmbedding,
              match_threshold: threshold,
              match_count: limit
            };
            
            console.log('フォールバックRPCパラメータ:', JSON.stringify(fallbackRpcParams));
            
            const { data: fallbackData, error: fallbackError } = await supabase.rpc('match_chunks', fallbackRpcParams);
            
            if (fallbackError) {
              console.error('❌ フォールバックベクトル検索もエラー:', fallbackError);
              console.log('キーワード検索にフォールバック...');
              return this.fallbackSearch(query);
            }
            
            console.log('Supabase フォールバックRPC 呼び出し成功, 結果:', fallbackData ? `${fallbackData.length}件` : '0件');
            
            if (!fallbackData || fallbackData.length === 0) {
              console.log('フォールバックベクトル検索でも結果が見つかりませんでした');
              return this.fallbackSearch(query);
            }
            
            // フォールバック検索結果を使用
            return this.processSearchResults(fallbackData);
          }
          
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
        return this.processSearchResults(data);
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
   * 検索結果を処理して標準形式に変換
   */
  private async processSearchResults(data: any[]): Promise<SearchResult[]> {
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

  /**
   * 拡張メタデータ検索 - キーワードと埋め込みを組み合わせた検索
   * @param query 拡張検索クエリ
   * @returns 検索結果の配列
   */
  async searchEnhanced(query: EnhancedSearchQuery): Promise<SearchResult[]> {
    console.log("\n\n=================================================================");
    console.log("🔴🔴🔴 RAGService.searchEnhanced() が発動しました 🔴🔴🔴");
    console.log("=================================================================\n\n");
    console.log(`拡張検索クエリ: "${query.query}"${query.filter ? ` (フィルター: ${JSON.stringify(query.filter)})` : ''}`);
    
    try {
      if (!query.query) {
        throw new Error('検索クエリが必要です');
      }
      
      // クエリテキストの埋め込みを生成
      console.log('検索クエリの埋め込みベクトルを生成中...')
      const queryEmbedding = await openaiEmbeddings.generateEmbedding(query.query);
      console.log('埋め込みベクトル生成完了:', queryEmbedding?.length || 0, '次元');
      
      // 検索パラメータ
      const threshold = 0.5;
      const limit = query.limit || 5;
      let rpcName: string;
      let rpcParams: any = {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit
      };
      
      // 検索タイプに基づいてRPC関数を選択
      if (query.useContext) {
        rpcName = 'contextual_search';
        rpcParams.context_count = query.contextCount || 1;
      } else if (query.tags && query.tags.length > 0) {
        rpcName = 'match_chunks_by_tags';
        rpcParams.tags = query.tags;
      } else if (query.keyword) {
        rpcName = 'match_chunks_enhanced';
        rpcParams.keyword = query.keyword;
        rpcParams.filter_source_type = query.filter?.source_type;
        
        // デバッグログ追加: フィルターソースタイプの詳細を出力
        console.log('🔍🔍🔍 filter_source_type詳細(RAGService) 🔍🔍🔍');
        console.log('query.filter:', JSON.stringify(query.filter));
        console.log('query.filter?.source_type:', query.filter?.source_type);
        console.log('rpcParams.filter_source_type:', rpcParams.filter_source_type);
      } else {
        rpcName = 'match_chunks_enhanced';
        rpcParams.filter_source_type = query.filter?.source_type;
        
        // デバッグログ追加: フィルターソースタイプの詳細を出力
        console.log('🔍🔍🔍 filter_source_type詳細(RAGService) 🔍🔍🔍');
        console.log('query.filter:', JSON.stringify(query.filter));
        console.log('query.filter?.source_type:', query.filter?.source_type);
        console.log('rpcParams.filter_source_type:', rpcParams.filter_source_type);
      }
      
      console.log(`Supabase RPC "${rpcName}" を呼び出します`);
      console.log('パラメータ:', rpcParams);
      
      // デバッグログ追加: SQLパラメータの詳細な型情報
      console.log('パラメータ型情報(RAGService):');
      for (const [key, value] of Object.entries(rpcParams)) {
        console.log(`- ${key}: ${typeof value} ${value === null ? '(null)' : value === undefined ? '(undefined)' : ''}`);
      }
      
      const startTime = Date.now();
      
      // RPC関数を呼び出し
      const { data, error } = await supabase.rpc(rpcName, rpcParams);
      
      const endTime = Date.now();
      console.log(`RPC呼び出し完了（実行時間: ${endTime - startTime}ms）`);
      
      if (error) {
        console.error('拡張検索エラー:', error);
        return this.search(query); // 通常の検索にフォールバック
      }
      
      if (!data || data.length === 0) {
        console.log('検索結果が見つかりませんでした');
        return [];
      }
      
      console.log(`検索で ${data.length} 件の結果が見つかりました`);
      
      // 検索結果を整形
      const results: SearchResult[] = [];
      for (const item of data) {
        // ドキュメント情報を取得（コンテキスト検索の場合はcontext_levelも含む）
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('title, source_type, source_id')
          .eq('id', item.document_id)
          .single();
        
        if (docError) {
          console.error('ドキュメント取得エラー:', docError);
          continue;
        }
        
        // 検索結果に変換
        results.push({
          content: item.content,
          metadata: {
            ...item.metadata,
            ...(item.context_level !== undefined ? { context_level: item.context_level } : {})
          },
          similarity: item.similarity || item.score || 0,
          source_type: docData?.source_type,
          source_id: docData?.source_id
        });
      }
      
      return results;
    } catch (error) {
      console.error('拡張検索エラー:', error);
      // 通常の検索にフォールバック
      return this.search(query);
    }
  }

  /**
   * キーワードによるハイブリッド検索
   * @param keyword 検索キーワード
   * @param limit 上限数
   * @param sourceType ソースタイプ
   * @returns 検索結果の配列
   */
  async searchByKeyword(keyword: string, limit: number = 5, sourceType?: string): Promise<SearchResult[]> {
    console.log("\n\n=================================================================");
    console.log("🔴🔴🔴 RAGService.searchByKeyword() が発動しました 🔴🔴🔴");
    console.log("=================================================================\n\n");
    console.log(`キーワード検索: "${keyword}"${sourceType ? ` (ソースタイプ: ${sourceType})` : ''}`);
    
    try {
      // ハイブリッド検索を実行
      const { data, error } = await supabase.rpc('hybrid_search', {
        search_query: keyword,
        match_count: limit,
        source_type: sourceType
      });
      
      if (error) {
        console.error('ハイブリッド検索エラー:', error);
        // キーワード検索にフォールバック
        return this.fallbackSearch({ query: keyword, limit });
      }
      
      if (!data || data.length === 0) {
        console.log('ハイブリッド検索で結果が見つかりませんでした');
        return [];
      }
      
      console.log(`ハイブリッド検索で ${data.length} 件の結果が見つかりました`);
      
      // 検索結果を整形
      return data.map((item: any) => ({
        content: item.content,
        metadata: item.metadata,
        similarity: item.score || 1.0,
        source_type: item.metadata?.source_type,
        source_id: item.metadata?.source_id
      }));
    } catch (error) {
      console.error('ハイブリッド検索エラー:', error);
      return this.fallbackSearch({ query: keyword, limit });
    }
  }

  /**
   * タグによる検索
   * @param query 検索クエリ
   * @param tags タグ配列
   * @param limit 上限数
   * @returns 検索結果の配列
   */
  async searchByTags(query: string, tags: string[], limit: number = 5): Promise<SearchResult[]> {
    console.log("\n\n=================================================================");
    console.log("🔴🔴🔴 RAGService.searchByTags() が発動しました 🔴🔴🔴");
    console.log("=================================================================\n\n");
    console.log(`タグ検索: "${query}" タグ:`, tags);
    
    try {
      // クエリ文字列の埋め込みを生成
      const queryEmbedding = await openaiEmbeddings.generateEmbedding(query);
      
      const { data, error } = await supabase.rpc('match_chunks_by_tags', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: limit,
        tags: tags
      });
      
      if (error) {
        console.error('タグ検索エラー:', error);
        return this.search({ query, limit });
      }
      
      if (!data || data.length === 0) {
        console.log('タグ検索で結果が見つかりませんでした');
        return [];
      }
      
      console.log(`タグ検索で ${data.length} 件の結果が見つかりました`);
      
      // 検索結果を整形
      const results: SearchResult[] = [];
      for (const item of data) {
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
      console.error('タグ検索エラー:', error);
      return this.search({ query, limit });
    }
  }
}

// シングルトンインスタンスをエクスポート
const ragService = new RAGService();
export default ragService;
