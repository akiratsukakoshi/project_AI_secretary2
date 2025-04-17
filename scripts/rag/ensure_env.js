/**
 * 環境変数確認ユーティリティ
 * スクリプト実行前に環境変数が設定されているか確認する
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

// APIキーが設定されているか確認
if (!process.env.OPENAI_API_KEY) {
  console.error('エラー: OPENAI_API_KEY が設定されていません');
  console.error('埋め込みベクトルの生成には OpenAI API キーが必要です');
  console.error('.env ファイルに OPENAI_API_KEY を設定してください');
  process.exit(1);
}

// Supabaseの設定が揃っているか確認
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('エラー: SUPABASE_URL または SUPABASE_KEY が設定されていません');
  console.error('データの保存には Supabase の設定が必要です');
  console.error('.env ファイルに SUPABASE_URL と SUPABASE_KEY を設定してください');
  process.exit(1);
}

// 埋め込みモデルが設定されているか確認（デフォルト値がある場合はOK）
if (!process.env.OPENAI_EMBEDDING_MODEL) {
  console.log('注意: OPENAI_EMBEDDING_MODEL が設定されていないため、text-embedding-3-small を使用します');
}

console.log('環境変数の確認が完了しました。スクリプトを実行します...');
