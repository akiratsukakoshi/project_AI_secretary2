"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// 環境変数の読み込み
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
// 環境変数のバリデーション
const validateEnv = () => {
    const requiredEnvVars = ['DISCORD_TOKEN', 'OPENAI_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
    if (missingEnvVars.length > 0) {
        throw new Error(`以下の環境変数が設定されていません: ${missingEnvVars.join(', ')}`);
    }
    return {
        DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        NODE_ENV: process.env.NODE_ENV || 'development',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    };
};
exports.env = validateEnv();
