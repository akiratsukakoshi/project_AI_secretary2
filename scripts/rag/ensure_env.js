// ensure_env.js
// このスクリプトは環境変数が正しくロードされていることを確認します
const dotenv = require('dotenv');
const path = require('path');

// プロジェクトルートディレクトリのパス
const rootDir = path.resolve(__dirname, '../../');
const envPath = path.resolve(rootDir, '.env');

console.log('Loading environment variables from:', envPath);

// 環境変数をロード
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('環境変数のロードに失敗しました:', result.error);
} else {
  console.log('Environment variables loaded successfully');
}

// 重要な環境変数が設定されているか確認
const requiredVars = ['SUPABASE_URL', 'SUPABASE_KEY'];
let missingVars = false;

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`警告: 環境変数 ${varName} が設定されていません`);
    missingVars = true;
  }
}

if (!missingVars) {
  console.log('すべての必須環境変数が設定されています');
}

// このスクリプト自体は何も行わず、環境変数がロードされたことを確認するだけです
