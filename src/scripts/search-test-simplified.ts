// src/scripts/search-test-simplified.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { OpenAI } from 'openai';

// 環境変数の読み込み
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// OpenAI クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supabase クライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase環境変数が設定されていません');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// RAG検索機能
async function searchRAG(query: string, sourceType?: string) {
  try {
    // クエリの埋め込みベクトルを生成
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    
    const embedding = response.data[0].embedding;
    
    // Supabaseでベクトル検索を実行
    const { data: chunks, error } = await supabase
      .rpc('match_chunks', {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 5,
        filter_source_type: sourceType || null
      });

    if (error) {
      throw new Error('検索エラー: ' + error.message);
    }

    return chunks || [];
  } catch (error) {
    console.error('検索処理中にエラーが発生しました:', error);
    throw error;
  }
} 

// テスト用のシンプルなメイン関数
async function main() {
  try {
    const query = '原っぱ大学とは何ですか？';
    console.log('検索クエリ: ' + query);
    
    // RAG検索を実行
    const searchResults = await searchRAG(query);
    console.log('検索結果: ' + searchResults.length + '件');
    
    // 検索結果の概要を表示
    console.log(JSON.stringify(searchResults, null, 2));
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
}

// スクリプトの実行
main();
