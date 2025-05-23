import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file first
// Ensure we resolve the path to the root directory .env file
const rootDir = path.resolve(__dirname, '../../');
const envPath = path.resolve(rootDir, '.env');
console.log("Loading environment variables from: " + envPath);
dotenv.config({ path: envPath });

// 環境変数が適切に設定されているか確認（ensure_envの代わりにインライン実装）
if (!process.env.OPENAI_API_KEY) {
  console.error('エラー: OPENAI_API_KEY が設定されていません');
  console.error('埋め込みベクトルの生成には OpenAI API キーが必要です');
  console.error('.env ファイルに OPENAI_API_KEY を設定してください');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('エラー: SUPABASE_URL または SUPABASE_KEY が設定されていません');
  console.error('データの保存には Supabase の設定が必要です');
  console.error('.env ファイルに SUPABASE_URL と SUPABASE_KEY を設定してください');
  process.exit(1);
}

console.log('環境変数の確認が完了しました');

// Now import the modules that depend on environment variables
// インポート方法の修正
import { default as ragService } from '../../src/services/supabase/ragService';

/**
 * 埋め込みベクトルNULLのチャンクを修復するスクリプト
 */
async function rebuildMissingEmbeddings() {
  try {
    console.log('NULL 埋め込みベクトルの再構築を開始します...');
    
    // コマンドライン引数からオプションを取得
    const args = process.argv.slice(2);
    let batchSize = 10; // デフォルトバッチサイズ
    let limit: number | undefined = undefined; // デフォルトは制限なし
    
    // バッチサイズ引数を解析
    const batchArg = args.find(arg => arg.startsWith('--batch='));
    if (batchArg) {
      const batchValue = batchArg.split('=')[1];
      if (batchValue) {
        batchSize = parseInt(batchValue, 10);
        if (isNaN(batchSize) || batchSize <= 0) {
          batchSize = 10;
          console.warn('無効なバッチサイズです。デフォルト値の10を使用します。');
        }
      }
    }
    
    // 制限引数を解析
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    if (limitArg) {
      const limitValue = limitArg.split('=')[1];
      if (limitValue) {
        const parsedLimit = parseInt(limitValue, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          limit = parsedLimit;
        } else {
          console.warn('無効な制限値です。制限なしで実行します。');
        }
      }
    }
    
    console.log("バッチサイズ: " + batchSize);
    console.log("制限: " + (limit !== undefined ? limit : '制限なし'));
    
    // NULL 埋め込みベクトルの再構築
    // rebuildEmbeddingsメソッドが存在するか確認
    if (typeof ragService.rebuildEmbeddings !== 'function') {
      console.error('エラー: ragService.rebuildEmbeddings メソッドが存在しません');
      console.error('ragServiceオブジェクトの内容:', Object.keys(ragService));
      throw new Error('rebuildEmbeddings メソッドが見つかりません');
    }
    
    const processedCount = await ragService.rebuildEmbeddings(batchSize, limit);
    
    if (processedCount > 0) {
      console.log("成功: " + processedCount + "個のチャンクの埋め込みベクトルを再構築しました。");
    } else {
      console.log('処理するNULL埋め込みベクトルのチャンクはありませんでした。');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
rebuildMissingEmbeddings()
  .then(() => {
    console.log('処理が完了しました。終了します。');
    process.exit(0);
  })
  .catch((error) => {
    console.error('致命的なエラーが発生しました:', error);
    process.exit(1);
  });
