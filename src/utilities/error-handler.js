"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGlobalErrorHandlers = exports.ValidationError = exports.ApiError = exports.AppError = void 0;
const logger_1 = __importDefault(require("./logger"));
class AppError extends Error {
    constructor(message, code = 'INTERNAL_ERROR', statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
        // Errorクラスとの互換性のため
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class ApiError extends AppError {
    constructor(message, code = 'API_ERROR', statusCode = 500) {
        super(message, code, statusCode);
        this.name = 'ApiError';
    }
}
exports.ApiError = ApiError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 'VALIDATION_ERROR', 400);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/**
 * グローバルなエラーハンドラー
 * 未捕捉のエラーをログに記録し、アプリケーションをクラッシュさせないようにする
 */
const setupGlobalErrorHandlers = () => {
    // 未処理のPromiseエラーのハンドリング
    process.on('unhandledRejection', (reason) => {
        logger_1.default.error('未処理のPromiseエラー:', reason);
    });
    // 未捕捉の例外のハンドリング
    process.on('uncaughtException', (error) => {
        logger_1.default.error('未捕捉の例外:', error);
        // 深刻なエラーの場合はプロセスを終了
        // 注意: 本番環境では、プロセス管理ツール（PM2など）でプロセスを再起動させる
        if (process.env.NODE_ENV === 'production') {
            logger_1.default.error('深刻なエラーが発生したため、プロセスを終了します');
            process.exit(1);
        }
    });
};
exports.setupGlobalErrorHandlers = setupGlobalErrorHandlers;
