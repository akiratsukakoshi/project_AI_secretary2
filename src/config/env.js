"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
var dotenv_1 = require("dotenv");
var path_1 = require("path");
// 環境変数の読み込み
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
// 環境変数のバリデーション
var validateEnv = function () {
    var requiredEnvVars = ['DISCORD_TOKEN', 'OPENAI_API_KEY'];
    var missingEnvVars = requiredEnvVars.filter(function (envVar) { return !process.env[envVar]; });
    if (missingEnvVars.length > 0) {
        throw new Error("\u4EE5\u4E0B\u306E\u74B0\u5883\u5909\u6570\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093: ".concat(missingEnvVars.join(', ')));
    }
    return {
        DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        NODE_ENV: process.env.NODE_ENV || 'development',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        GOOGLE_CALENDAR_MCP_URL: process.env.GOOGLE_CALENDAR_MCP_URL,
        GOOGLE_CALENDAR_MCP_API_KEY: process.env.GOOGLE_CALENDAR_MCP_API_KEY,
        NOTION_MCP_URL: process.env.NOTION_MCP_URL,
        NOTION_MCP_API_KEY: process.env.NOTION_MCP_API_KEY,
        MCP_CONFIG_PATH: process.env.MCP_CONFIG_PATH || '/home/tukapontas/ai-secretary2/mcp-config.json',
        LOG_MAX_SIZE: process.env.LOG_MAX_SIZE,
        LOG_MAX_FILES: process.env.LOG_MAX_FILES,
        LOG_DIRECTORY: process.env.LOG_DIRECTORY,
        LOG_DEBUG_TO_FILE: process.env.LOG_DEBUG_TO_FILE,
        LOG_TRACE_TO_FILE: process.env.LOG_TRACE_TO_FILE,
    };
};
exports.env = validateEnv();
