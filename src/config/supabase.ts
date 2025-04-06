import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// 環境変数のチェック
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase環境変数が設定されていません');
}

// Supabaseクライアントを作成
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
