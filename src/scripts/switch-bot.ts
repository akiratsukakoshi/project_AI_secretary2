import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * ボット設定状態ファイルのパス
 */
const BOT_STATE_FILE = path.join(process.cwd(), 'config', 'bot-state.json');
const BOTS_DIR = path.join(process.cwd(), 'config', 'bots');

/**
 * ボットプロファイルを切り替えるスクリプト
 */
async function switchBotProfile() {
  try {
    console.log('===== ボットプロファイル切り替えツール =====');
    
    // コマンドライン引数からプロファイル名を取得
    const args = process.argv.slice(2);
    const profileName = args[0];
    
    // 利用可能なプロファイルを取得
    const availableProfiles = getAvailableProfiles();
    
    if (!profileName) {
      // 利用可能なプロファイルを表示
      console.log('利用可能なプロファイル:');
      
      if (availableProfiles.length > 0) {
        availableProfiles.forEach((profile, index) => {
          const isCurrentProfile = getCurrentBotName() === profile;
          console.log(`${index + 1}. ${profile}${isCurrentProfile ? ' (現在選択中)' : ''}`);
        });
        console.log('\n使用方法: npm run switch-bot -- <プロファイル名>');
      } else {
        console.log('プロファイルが見つかりません。config/bots/ ディレクトリにYAMLファイルを作成してください。');
      }
      return;
    }
    
    // プロファイルの切り替え
    const success = switchProfile(profileName);
    
    if (success) {
      console.log(`✅ ボットプロファイルを "${profileName}" に切り替えました`);
      
      // 新しいプロファイルの設定を表示
      const configPath = path.join(BOTS_DIR, `${profileName}.yml`);
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(fileContent) as any;
        
        console.log('\n----- 新しいボット設定 -----');
        console.log(`名前: ${config.name}`);
        console.log(`表示名: ${config.display_name}`);
        console.log(`説明: ${config.description}`);
        console.log(`システムプロンプト (一部): ${config.system_prompt.substring(0, 50)}...`);
      }
    } else {
      console.error(`❌ プロファイル "${profileName}" への切り替えに失敗しました`);
      console.log('\n利用可能なプロファイル:');
      if (availableProfiles.length > 0) {
        availableProfiles.forEach((profile, index) => {
          console.log(`${index + 1}. ${profile}`);
        });
      } else {
        console.log('プロファイルが見つかりません。');
      }
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

/**
 * 利用可能なボットプロファイルのリストを取得
 */
function getAvailableProfiles(): string[] {
  try {
    if (!fs.existsSync(BOTS_DIR)) {
      return [];
    }
    
    // .ymlファイルを検索して拡張子を除いた名前を返す
    return fs.readdirSync(BOTS_DIR)
      .filter(file => file.endsWith('.yml'))
      .map(file => file.replace('.yml', ''));
  } catch (error) {
    console.error(`利用可能なプロファイル取得エラー: ${error}`);
    return [];
  }
}

/**
 * ボットプロファイルを切り替え
 */
function switchProfile(botName: string): boolean {
  try {
    // 指定されたボット設定ファイルが存在するか確認
    const configPath = path.join(BOTS_DIR, `${botName}.yml`);
    if (!fs.existsSync(configPath)) {
      console.error(`ボット設定ファイルが見つかりません: ${configPath}`);
      return false;
    }
    
    // 状態を保存
    const state = {
      currentBotName: botName,
      lastUpdated: new Date().toISOString()
    };
    
    // configディレクトリがなければ作成
    const configDir = path.dirname(BOT_STATE_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(BOT_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    console.log(`ボット状態を保存しました: ${botName}`);
    return true;
  } catch (error) {
    console.error(`ボットプロファイル切り替えエラー: ${error}`);
    return false;
  }
}

/**
 * 現在のボット名を取得
 */
function getCurrentBotName(): string {
  try {
    if (fs.existsSync(BOT_STATE_FILE)) {
      const stateData = fs.readFileSync(BOT_STATE_FILE, 'utf8');
      const state = JSON.parse(stateData);
      
      if (state.currentBotName) {
        return state.currentBotName;
      }
    }
    return 'gakuco'; // デフォルト
  } catch (error) {
    console.error(`ボット状態の読み込みに失敗しました: ${error}`);
    return 'gakuco';
  }
}

// スクリプト実行
switchBotProfile(); 