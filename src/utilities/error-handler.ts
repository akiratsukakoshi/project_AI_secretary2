import logger from './logger';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'INTERNAL_ERROR', statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    
    // Errorクラスとの互換性のため
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ApiError extends AppError {
  constructor(message: string, code = 'API_ERROR', statusCode = 500) {
    super(message, code, statusCode);
    this.name = 'ApiError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

/**
 * グローバルなエラーハンドラー
 * 未捕捉のエラーをログに記録し、アプリケーションをクラッシュさせないようにする
 */
export const setupGlobalErrorHandlers = (): void => {
  // 未処理のPromiseエラーのハンドリング
  process.on('unhandledRejection', (reason: Error | any) => {
    logger.error('未処理のPromiseエラー:', reason);
  });

  // 未捕捉の例外のハンドリング
  process.on('uncaughtException', (error: Error) => {
    logger.error('未捕捉の例外:', error);
    
    // 深刻なエラーの場合はプロセスを終了
    // 注意: 本番環境では、プロセス管理ツール（PM2など）でプロセスを再起動させる
    if (process.env.NODE_ENV === 'production') {
      logger.error('深刻なエラーが発生したため、プロセスを終了します');
      process.exit(1);
    }
  });
};