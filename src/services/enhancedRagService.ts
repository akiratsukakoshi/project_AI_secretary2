import supabase from '../config/supabase';
import { SearchResult } from '../interfaces/rag';
import ragService from './supabase/ragService';
import openaiEmbeddings from './openaiEmbeddings';

/**
 * 拡張検索クエリインターフェース
 */
export interface EnhancedSearchQuery {
  query: string;
  keyword?: string;
  tags?: string[];
  useContext?: boolean;
  contextCount?: number;
  limit?: number;
  filter?: {
    source_type?: string;
  };
}

/**
 * 拡張RAGサービス - メタデータを活用した高度な検索機能
 */
class EnhancedRagService {
  /**
   * 拡張メタデータ検索 - キーワードと埋め込みを組み合わせた検索
   * @param query 拡張検索クエリ
   * @returns 検索結果の配列
   */
  async searchEnhanced(query: EnhancedSearchQuery): Promise<SearchResult[]> {
    console.log("\n\n=================================================================");
    console.log("🔴🔴🔴 EnhancedRAGService.searchEnhanced() が発動しました 🔴🔴🔴");
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
        console.log('🔍🔍🔍 filter_source_type詳細 🔍🔍🔍');
        console.log('query.filter:', JSON.stringify(query.filter));
        console.log('query.filter?.source_type:', query.filter?.source_type);
        console.log('rpcParams.filter_source_type:', rpcParams.filter_source_type);
      } else {
        rpcName = 'match_chunks_enhanced';
        rpcParams.filter_source_type = query.filter?.source_type;
        
        // デバッグログ追加: フィルターソースタイプの詳細を出力
        console.log('🔍🔍🔍 filter_source_type詳細 🔍🔍🔍');
        console.log('query.filter:', JSON.stringify(query.filter));
        console.log('query.filter?.source_type:', query.filter?.source_type);
        console.log('rpcParams.filter_source_type:', rpcParams.filter_source_type);
      }
      
      console.log(`Supabase RPC "${rpcName}" を呼び出します`);
      console.log('パラメータ:', rpcParams);
      
      // デバッグログ追加: SQLパラメータの詳細な型情報
      console.log('パラメータ型情報:');
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
        return ragService.search(query); // 通常の検索にフォールバック
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
      return ragService.search(query);
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
    console.log("🔴🔴🔴 EnhancedRAGService.searchByKeyword() が発動しました 🔴🔴🔴");
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
        return ragService.search({ query: keyword, limit });
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
      return ragService.search({ query: keyword, limit });
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
    console.log("🔴🔴🔴 EnhancedRAGService.searchByTags() が発動しました 🔴🔴🔴");
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
        return ragService.search({ query, limit });
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
      return ragService.search({ query, limit });
    }
  }
}

// シングルトンインスタンスをエクスポート
const enhancedRagService = new EnhancedRagService();
export default enhancedRagService; 