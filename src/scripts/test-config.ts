import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * 設定の読み込みをテストするスクリプト
 */
async function testConfigLoading() {
  try {
    console.log('===== 設定読み込みテスト開始 =====');
    
    // 設定ディレクトリのパス
    const configDir = path.join(process.cwd(), 'config');
    const botConfigPath = path.join(configDir, 'bots', 'gakuco.yml');
    
    console.log(`設定ファイルパス: ${botConfigPath}`);
    console.log(`ファイル存在: ${fs.existsSync(botConfigPath) ? 'はい' : 'いいえ'}`);
    
    // YAMLファイルを直接読み込む
    if (fs.existsSync(botConfigPath)) {
      const fileContent = fs.readFileSync(botConfigPath, 'utf8');
      const botConfig = yaml.load(fileContent) as any;
      
      console.log('\n----- ボット設定 -----');
      console.log(`名前: ${botConfig.name}`);
      console.log(`表示名: ${botConfig.display_name}`);
      console.log(`バージョン: ${botConfig.version}`);
      console.log(`説明: ${botConfig.description}`);
      
      // システムプロンプトの表示（最初の100文字のみ）
      if (botConfig.system_prompt) {
        console.log(`システムプロンプト: ${botConfig.system_prompt.substring(0, 100)}...`);
      }
      
      // その他の設定を表示
      if (botConfig.traits) {
        console.log(`特性: ${botConfig.traits.join(', ')}`);
      }
      
      if (botConfig.trigger_words) {
        console.log(`トリガーワード: ${botConfig.trigger_words.join(', ')}`);
      }
    } else {
      console.log('ボット設定ファイルが見つかりません');
    }
    
    console.log('\n===== 設定読み込みテスト完了 =====');
  } catch (error) {
    console.error('設定読み込みテスト中にエラーが発生しました:', error);
  }
}

// スクリプト実行
testConfigLoading(); 