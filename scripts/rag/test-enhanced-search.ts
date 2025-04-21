import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import openaiEmbeddings from '../../src/services/openaiEmbeddings';
import { SearchResult } from '../../src/interfaces/rag';
import supabase from '../../src/config/supabase';
import RAGService from '../../src/services/supabase/ragService';
import enhancedRagService from '../../src/services/enhancedRagService';

// 環境変数を読み込む
dotenv.config();

// Supabaseサービスが初期化されていることを確認
if (!supabase) {
  console.error('Supabaseクライアントが初期化されていません');
  process.exit(1);
}

/**
 * 拡張検索機能のテスト
 */
async function testEnhancedSearch() {
  try {
    // インポートしたRAGServiceのメソッドを直接呼び出す
    console.log('拡張検索機能のテストを開始します...');
    
    // テスト用の検索クエリ
    const searchQuery = process.argv[2] || '原っぱ大学について教えてください';
    console.log(`検索クエリ: "${searchQuery}"`);
    
    // 1. 標準検索
    console.log('\n1. 標準検索のテスト:');
    const standardResults = await RAGService.search({
      query: searchQuery,
      limit: 3
    });
    
    console.log(`標準検索結果: ${standardResults.length}件`);
    standardResults.forEach((result: SearchResult, i: number) => {
      console.log(`結果 ${i+1}: "${result.content.substring(0, 100)}..."`);
      console.log(`類似度: ${result.similarity}, ソース: ${result.source_type || '不明'}\n`);
    });
    
    // 2. キーワード強化検索
    console.log('\n2. キーワード強化検索のテスト:');
    const enhancedResults = await enhancedRagService.searchEnhanced({
      query: searchQuery,
      keyword: '大学',
      limit: 3
    });
    
    console.log(`キーワード強化検索結果: ${enhancedResults.length}件`);
    enhancedResults.forEach((result: SearchResult, i: number) => {
      console.log(`結果 ${i+1}: "${result.content.substring(0, 100)}..."`);
      console.log(`類似度: ${result.similarity}, ソース: ${result.source_type || '不明'}\n`);
    });
    
    // 3. タグ検索
    console.log('\n3. タグ検索のテスト:');
    const tagResults = await enhancedRagService.searchByTags(
      searchQuery,
      ['教育', '大学'],
      3
    );
    
    console.log(`タグ検索結果: ${tagResults.length}件`);
    tagResults.forEach((result: SearchResult, i: number) => {
      console.log(`結果 ${i+1}: "${result.content.substring(0, 100)}..."`);
      console.log(`類似度: ${result.similarity}, ソース: ${result.source_type || '不明'}\n`);
    });
    
    // 4. コンテキスト検索
    console.log('\n4. コンテキスト検索のテスト:');
    const contextResults = await enhancedRagService.searchEnhanced({
      query: searchQuery,
      useContext: true,
      contextCount: 1,
      limit: 2
    });
    
    console.log(`コンテキスト検索結果: ${contextResults.length}件`);
    contextResults.forEach((result: SearchResult, i: number) => {
      const contextLevel = result.metadata?.context_level !== undefined 
        ? `コンテキストレベル: ${result.metadata.context_level}` 
        : '';
      console.log(`結果 ${i+1}: "${result.content.substring(0, 100)}..." ${contextLevel}`);
      console.log(`類似度: ${result.similarity}, ソース: ${result.source_type || '不明'}\n`);
    });
    
    console.log('拡張検索テスト完了');
  } catch (error) {
    console.error('テストエラー:', error);
  }
}

// スクリプト実行
testEnhancedSearch().catch(console.error); 