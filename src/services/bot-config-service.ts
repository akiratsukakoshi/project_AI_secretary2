import configLoader from '../utilities/config-loader';
import logger from '../utilities/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ボット設定状態ファイルのパス
 */
const BOT_STATE_FILE = path.join(process.cwd(), 'config', 'bot-state.json');

class BotConfigService {
  private currentBotName: string = 'gakuco';
  
  constructor() {
    this.loadBotState();
  }
  
  /**
   * 現在のボット設定を取得
   */
  getCurrentBotConfig(): any {
    return configLoader.getBotConfig(this.currentBotName);
  }
  
  /**
   * 現在のボット名を取得
   */
  getCurrentBotName(): string {
    return this.currentBotName;
  }
  
  /**
   * ボットプロファイルを切り替え
   * @param botName 使用するボット名
   */
  switchBotProfile(botName: string): boolean {
    try {
      // 指定されたボット設定ファイルが存在するか確認
      const configPath = path.join(process.cwd(), 'config', 'bots', `${botName}.yml`);
      if (!fs.existsSync(configPath)) {
        logger.error(`ボット設定ファイルが見つかりません: ${configPath}`);
        return false;
      }
      
      // ボット名を切り替え
      this.currentBotName = botName;
      
      // 状態を保存
      this.saveBotState();
      
      // キャッシュをクリアして新しい設定を読み込むように強制
      configLoader.clearCache();
      
      logger.info(`ボットプロファイルを切り替えました: ${botName}`);
      return true;
    } catch (error) {
      logger.error(`ボットプロファイル切り替えエラー: ${error}`);
      return false;
    }
  }
  
  /**
   * 利用可能なボットプロファイルのリストを取得
   */
  getAvailableProfiles(): string[] {
    try {
      const botsDir = path.join(process.cwd(), 'config', 'bots');
      if (!fs.existsSync(botsDir)) {
        return [];
      }
      
      // .ymlファイルを検索して拡張子を除いた名前を返す
      return fs.readdirSync(botsDir)
        .filter(file => file.endsWith('.yml'))
        .map(file => file.replace('.yml', ''));
    } catch (error) {
      logger.error(`利用可能なプロファイル取得エラー: ${error}`);
      return [];
    }
  }
  
  /**
   * 現在のボット状態をファイルに保存
   */
  private saveBotState(): void {
    try {
      const state = {
        currentBotName: this.currentBotName,
        lastUpdated: new Date().toISOString()
      };
      
      // configディレクトリがなければ作成
      const configDir = path.dirname(BOT_STATE_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(BOT_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
      logger.debug(`ボット状態を保存しました: ${this.currentBotName}`);
    } catch (error) {
      logger.error(`ボット状態の保存に失敗しました: ${error}`);
    }
  }
  
  /**
   * 保存されたボット状態を読み込む
   */
  private loadBotState(): void {
    try {
      if (fs.existsSync(BOT_STATE_FILE)) {
        const stateData = fs.readFileSync(BOT_STATE_FILE, 'utf8');
        const state = JSON.parse(stateData);
        
        if (state.currentBotName) {
          // 該当のボット設定ファイルが存在するか確認
          const configPath = path.join(process.cwd(), 'config', 'bots', `${state.currentBotName}.yml`);
          if (fs.existsSync(configPath)) {
            this.currentBotName = state.currentBotName;
            logger.info(`前回使用したボットプロファイルを読み込みました: ${this.currentBotName}`);
          } else {
            logger.warn(`前回使用したボットプロファイル "${state.currentBotName}" が見つかりません。デフォルトを使用します。`);
          }
        }
      }
    } catch (error) {
      logger.error(`ボット状態の読み込みに失敗しました: ${error}`);
    }
  }
}

export default new BotConfigService(); 