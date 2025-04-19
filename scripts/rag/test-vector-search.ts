import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env file
const rootDir = path.resolve(__dirname, '../../');
const envPath = path.resolve(rootDir, '.env');
console.log(`Loading environment variables from: ${envPath}`);
dotenv.config({ path: envPath });

import supabase from '../../src/config/supabase';
import openaiEmbeddings from '../../src/services/openaiEmbeddings';
import ragService from '../../src/services/supabase/ragService';

async function testVectorSearch() {
  console.log('RAGベクトル検索テストスクリプト');
  console.log('--------------------------\n');
  
  // コマンドライン引数から検索クエリを取得
  const args = process.argv.slice(2);
  const searchQuery = args[0] || 'RAGシステム';
  
  console.log(`検索クエリ: "${searchQuery}"\n`);
  
  try {
    // 1. キーワード検索テスト（search APIを使用）
    console.log('## キーワード検索テスト');
    
    // 通常の検索APIを使用して実行
    // Note: fallbackSearchは private なので直接アクセスできない
    // 代わりに public な search API を使用
    const keywordResults = await ragService.search({
      query: searchQuery,
      limit: 3
    });
    
    console.log(`キーワード検索結果: ${keywordResults.length}件\n`);
    keywordResults.forEach((result: any, i: number) => {
      console.log(`結果 ${i+1}: "${result.content.substring(0, 100)}..."`);
      console.log(`類似度: ${result.similarity}, ソース: ${result.source_type || '不明'}\n`);
    });
    
    // 2. ベクトル検索テスト（RPC関数直接呼び出し）
    console.log('\n## ベクトル検索テスト (RPC関数)');
    
    try {
      // 検索クエリの埋め込みベクトルを生成
      console.log('埋め込みベクトル生成中...');
      const queryEmbedding = await openaiEmbeddings.generateEmbedding(searchQuery);
      console.log(`埋め込みベクトル生成完了 (${queryEmbedding.length}次元)`);
      
      // RPC関数を呼び出し
      console.log('match_chunks RPC関数呼び出し中...');
      const { data: vectorResults, error } = await supabase.rpc('match_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 3
      });
      
      if (error) {
        throw error;
      }
      
      console.log(`ベクトル検索結果: ${vectorResults?.length || 0}件\n`);
      
      if (vectorResults && vectorResults.length > 0) {
        for (const [i, result] of vectorResults.entries()) {
          // ドキュメント情報を取得
          const { data: docData } = await supabase
            .from('documents')
            .select('title, source_type')
            .eq('id', result.document_id)
            .single();
          
          console.log(`結果 ${i+1}: "${result.content.substring(0, 100)}..."`);
          console.log(`類似度: ${result.similarity.toFixed(4)}, ソース: ${docData?.source_type || '不明'}`);
          console.log(`ドキュメント: ${docData?.title || '不明'}\n`);
        }
      } else {
        console.log('結果が見つかりませんでした。');
      }
    } catch (error) {
      console.error('ベクトル検索エラー:', error);
      console.log('\nエラー: ベクトル検索に失敗しました。RPC関数が適切に設定されていない可能性があります。');
      console.log('Supabaseで以下のSQLを実行してください:');
      console.log(`
-- 既存の関数を削除
DROP FUNCTION IF EXISTS match_chunks(vector, double precision, integer);

-- ベクトル検索用RPC関数
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  content text,
  metadata jsonb,
  similarity float,
  document_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chunks.id,
    chunks.content,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) as similarity,
    chunks.document_id
  FROM chunks
  WHERE 1 - (chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
      `);
    }
    
    // 3. 再度検索テスト（比較のため）
    console.log('\n## 確認用検索テスト');
    const searchResults = await ragService.search({
      query: searchQuery,
      limit: 3
    });
    
    console.log(`検索結果: ${searchResults.length}件\n`);
    searchResults.forEach((result: any, i: number) => {
      console.log(`結果 ${i+1}: "${result.content.substring(0, 100)}..."`);
      console.log(`類似度: ${result.similarity}, ソース: ${result.source_type || '不明'}\n`);
    });
    
    console.log('テスト完了');
    
  } catch (error) {
    console.error('検索テストエラー:', error);
  }
}

// スクリプト実行
testVectorSearch().catch(console.error);