import { env } from '../config/env';

// 簡易的なロガーの実装
// 将来的にはWinstonなどのライブラリに置き換える予定

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = this.parseLogLevel(env.LOG_LEVEL || 'info');
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
    const metaStr = meta.length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  error(message: string, ...meta: any[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message, ...meta));
    }
  }

  warn(message: string, ...meta: any[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, ...meta));
    }
  }

  info(message: string, ...meta: any[]): void {
    if (this.level >= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message, ...meta));
    }
  }

  debug(message: string, ...meta: any[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, ...meta));
    }
  }

  trace(message: string, ...meta: any[]): void {
    if (this.level >= LogLevel.TRACE) {
      console.log(this.formatMessage('TRACE', message, ...meta));
    }
  }
}

export default new Logger();