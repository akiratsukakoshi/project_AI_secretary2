import { env } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

// 拡張ロガーの実装
// シングルトンパターンでアプリケーション全体で共有

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

// タイムスタンプ付きのファイル名を生成するヘルパー関数
const getTimestampedFilename = (baseFilename: string): string => {
  const now = new Date();
  const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `${baseFilename}-${datePart}.log`;
};

class Logger {
  private level: LogLevel;
  private maxLogFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxLogFiles: number = 5; // 保持するログファイル数
  private logDirectory: string = path.resolve(process.cwd(), 'logs');
  private errorLogPath: string;
  private combinedLogPath: string;
  
  // エラーカウント（統計用）
  private errorCount: Map<string, number> = new Map();
  
  // 前回のエラーメッセージ（重複防止用）
  private lastErrorMessage: string = '';
  private lastErrorTime: number = 0;
  private duplicateThreshold: number = 1000; // 同一エラーの繰り返し間隔（ミリ秒）

  constructor() {
    this.level = this.parseLogLevel(env.LOG_LEVEL || 'info');
    
    // カスタム設定の適用
    if (env.LOG_MAX_SIZE) {
      // 文字列をパースして数値に変換
      this.maxLogFileSize = parseInt(env.LOG_MAX_SIZE) * 1024 * 1024; // MB単位
    }
    
    if (env.LOG_MAX_FILES) {
      // 文字列をパースして数値に変換
      this.maxLogFiles = parseInt(env.LOG_MAX_FILES);
    }
    
    if (env.LOG_DIRECTORY) {
      // 文字列パスでリゾルブ
      this.logDirectory = path.resolve(process.cwd(), env.LOG_DIRECTORY);
    }
    
    // ログディレクトリの作成
    this.ensureLogDirectory();
    
    // ログファイルパスの設定
    this.errorLogPath = path.join(this.logDirectory, getTimestampedFilename('error'));
    this.combinedLogPath = path.join(this.logDirectory, getTimestampedFilename('combined'));
    
    // プロセス終了時の統計出力
    process.on('exit', () => {
      this.outputErrorStats();
    });
  }

  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error(`ログディレクトリの作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error':
        return LogLevel.ERROR;
      case 'warn':
        return LogLevel.WARN;
      case 'info':
        return LogLevel.INFO;
      case 'debug':
        return LogLevel.DEBUG;
      case 'trace':
        return LogLevel.TRACE;
      default:
        return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, ...meta: any[]): string {
    const timestamp = new Date().toISOString();
    let metaStr = '';
    
    // メタデータの整形（読みやすさ向上）
    if (meta.length > 0) {
      try {
        metaStr = ` ${JSON.stringify(meta, this.circularReplacer(), 2)}`;
      } catch (e) {
        // JSON変換エラー時の代替処理
        metaStr = ` [Meta conversion error: ${e instanceof Error ? e.message : String(e)}]`;
      }
    }
    
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }
  
  // 循環参照対応のJSON変換ヘルパー
  private circularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      // 無視すべきプロパティをスキップ
      if (key === 'password' || key === 'token' || key === 'secret') {
        return '[REDACTED]';
      }
      
      // 循環参照の検出と処理
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      
      // 長すぎる配列や文字列の省略
      if (Array.isArray(value) && value.length > 50) {
        return `[Array(${value.length}) - truncated]`;
      }
      
      if (typeof value === 'string' && value.length > 1000) {
        return value.substring(0, 1000) + '... [truncated]';
      }
      
      return value;
    };
  }
  
  // ファイルへのログ書き込み
  private writeToFile(filePath: string, message: string): void {
    try {
      // ファイルが存在しなければ作成
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '');
      }
      
      // ファイルサイズをチェック
      const stats = fs.statSync(filePath);
      if (stats.size > this.maxLogFileSize) {
        this.rotateLogFile(filePath);
      }
      
      // ログを追記
      fs.appendFileSync(filePath, message + '\n');
    } catch (error) {
      console.error(`ログファイルへの書き込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // ログローテーション
  private rotateLogFile(filePath: string): void {
    try {
      const baseName = path.basename(filePath);
      const dirName = path.dirname(filePath);
      const baseNameWithoutDate = baseName.split('-')[0];
      
      // 既存のログファイルを検索して日付でソート
      const files = fs.readdirSync(dirName)
        .filter(file => file.startsWith(baseNameWithoutDate))
        .sort((a, b) => fs.statSync(path.join(dirName, b)).mtime.getTime() - 
                         fs.statSync(path.join(dirName, a)).mtime.getTime());
      
      // 古いファイルの削除
      while (files.length >= this.maxLogFiles) {
        const oldFile = files.pop();
        if (oldFile) {
          fs.unlinkSync(path.join(dirName, oldFile));
        }
      }
      
      // 新しいファイルパスを生成
      const newFilePath = path.join(dirName, getTimestampedFilename(baseNameWithoutDate));
      
      // ファイル名を変更
      if (filePath === this.errorLogPath) {
        this.errorLogPath = newFilePath;
      } else if (filePath === this.combinedLogPath) {
        this.combinedLogPath = newFilePath;
      }
    } catch (error) {
      console.error(`ログローテーションに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // エラーの種類ごとの統計を出力
  private outputErrorStats(): void {
    if (this.errorCount.size === 0) return;
    
    const statsMessage = `\n[${new Date().toISOString()}] [INFO] エラー統計:\n` + 
      Array.from(this.errorCount.entries())
        .map(([type, count]) => `- ${type}: ${count}件`)
        .join('\n');
        
    console.info(statsMessage);
    this.writeToFile(this.errorLogPath, statsMessage);
  }
  
  // エラータイプを抽出（エラー統計用）
  private getErrorType(message: string, meta: any[]): string {
    // 既知のエラーパターンを検出
    if (message.includes('関数呼び出し') || message.includes('function')) {
      return 'FunctionCallPattern';
    }
    
    if (message.includes('パース') || message.includes('parse')) {
      return 'JSONParseError';
    }
    
    if (message.includes('データベースID') || message.includes('taskDbId')) {
      return 'DatabaseIDError';
    }
    
    if (message.includes('サニタイズ') || message.includes('sanitize')) {
      return 'SanitizationError';
    }
    
    // メタデータからエラー名を検出
    if (meta && meta.length > 0) {
      const firstMeta = meta[0];
      if (typeof firstMeta === 'object' && firstMeta !== null) {
        if (firstMeta.errorName) return firstMeta.errorName;
        if (firstMeta.name) return firstMeta.name;
        if (firstMeta.error && typeof firstMeta.error === 'string') {
          if (firstMeta.error.includes('taskDbId')) return 'TaskDbIdError';
          if (firstMeta.error.includes('timeout')) return 'TimeoutError';
        }
      }
    }
    
    return 'OtherError';
  }

  // 重複エラーチェック（短時間での同一エラーの繰り返しを防止）
  private isDuplicateError(message: string): boolean {
    const now = Date.now();
    if (message === this.lastErrorMessage && 
        (now - this.lastErrorTime) < this.duplicateThreshold) {
      return true;
    }
    
    this.lastErrorMessage = message;
    this.lastErrorTime = now;
    return false;
  }

  error(message: string, ...meta: any[]): void {
    if (this.level >= LogLevel.ERROR) {
      // 重複エラーチェック
      if (this.isDuplicateError(message)) return;
      
      // エラータイプの追跡
      const errorType = this.getErrorType(message, meta);
      this.errorCount.set(errorType, (this.errorCount.get(errorType) || 0) + 1);
      
      // フォーマットしたメッセージ
      const formattedMessage = this.formatMessage('ERROR', message, ...meta);
      
      // コンソールとファイルに出力
      console.error(formattedMessage);
      this.writeToFile(this.errorLogPath, formattedMessage);
      this.writeToFile(this.combinedLogPath, formattedMessage);
      
      // スタックトレース情報の追加（デバッグに有用）
      const stackTrace = new Error().stack;
      if (stackTrace) {
        const stackMessage = `[${new Date().toISOString()}] [STACK] ${stackTrace}`;
        this.writeToFile(this.errorLogPath, stackMessage);
      }
    }
  }

  warn(message: string, ...meta: any[]): void {
    if (this.level >= LogLevel.WARN) {
      const formattedMessage = this.formatMessage('WARN', message, ...meta);
      console.warn(formattedMessage);
      this.writeToFile(this.combinedLogPath, formattedMessage);
    }
  }

  info(message: string, ...meta: any[]): void {
    if (this.level >= LogLevel.INFO) {
      const formattedMessage = this.formatMessage('INFO', message, ...meta);
      console.info(formattedMessage);
      this.writeToFile(this.combinedLogPath, formattedMessage);
    }
  }

  debug(message: string, ...meta: any[]): void {
    if (this.level >= LogLevel.DEBUG) {
      const formattedMessage = this.formatMessage('DEBUG', message, ...meta);
      console.debug(formattedMessage);
      
      // デバッグレベルのログはファイル容量節約のため記録しない
      // 設定がある場合のみファイルに書き込み
      if (env.LOG_DEBUG_TO_FILE === 'true') {
        this.writeToFile(this.combinedLogPath, formattedMessage);
      }
    }
  }

  trace(message: string, ...meta: any[]): void {
    if (this.level >= LogLevel.TRACE) {
      const formattedMessage = this.formatMessage('TRACE', message, ...meta);
      console.log(formattedMessage);
      
      // トレースレベルのログはファイル容量節約のため記録しない
      // 設定がある場合のみファイルに書き込み
      if (env.LOG_TRACE_TO_FILE === 'true') {
        this.writeToFile(this.combinedLogPath, formattedMessage);
      }
    }
  }
}

export default new Logger();