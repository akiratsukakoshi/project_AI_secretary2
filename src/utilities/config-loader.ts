import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import logger from './logger';

class ConfigLoader {
  private configCache: Map<string, any> = new Map();
  private rootConfigPath: string;

  constructor(rootConfigPath: string = path.join(process.cwd(), 'config')) {
    this.rootConfigPath = rootConfigPath;
    // 設定ディレクトリの存在確認と作成
    if (!fs.existsSync(rootConfigPath)) {
      try {
        fs.mkdirSync(rootConfigPath, { recursive: true });
        fs.mkdirSync(path.join(rootConfigPath, 'bots'), { recursive: true });
        logger.info(`設定ディレクトリを作成しました: ${rootConfigPath}`);
      } catch (error) {
        logger.error(`設定ディレクトリの作成に失敗しました: ${error}`);
      }
    }
  }

  /**
   * YAMLファイルからの設定読み込み
   */
  loadConfig<T>(configPath: string): T {
    try {
      // キャッシュされているかチェック
      if (this.configCache.has(configPath)) {
        return this.configCache.get(configPath) as T;
      }

      // 絶対パスでない場合、ルート設定ディレクトリからの相対パスとする
      const fullPath = path.isAbsolute(configPath) 
        ? configPath 
        : path.join(this.rootConfigPath, configPath);

      // ファイルが存在するか確認
      if (!fs.existsSync(fullPath)) {
        throw new Error(`設定ファイルが見つかりません: ${fullPath}`);
      }

      // YAMLファイルを読み込み、解析
      const fileContent = fs.readFileSync(fullPath, 'utf8');
      const config = yaml.load(fileContent) as T;

      // キャッシュに保存
      this.configCache.set(configPath, config);
      
      logger.info(`設定ファイルを読み込みました: ${configPath}`);
      return config;
    } catch (error) {
      logger.error(`設定ファイル読み込みエラー (${configPath}): ${error}`);
      throw error;
    }
  }

  /**
   * デフォルトのボット設定を取得
   */
  getBotConfig(botName: string = 'gakuco'): any {
    return this.loadConfig(`bots/${botName}.yml`);
  }

  /**
   * キャッシュされた設定をクリア
   */
  clearCache(): void {
    this.configCache.clear();
  }
}

// シングルトンインスタンスをエクスポート
export default new ConfigLoader(); 