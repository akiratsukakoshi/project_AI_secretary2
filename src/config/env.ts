import dotenv from 'dotenv';
import path from 'path';

// 環境変数の読み込み
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface EnvironmentVariables {
  DISCORD_TOKEN: string;
  OPENAI_API_KEY: string;
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL?: string;
  GOOGLE_CALENDAR_MCP_URL?: string;
  GOOGLE_CALENDAR_MCP_API_KEY?: string;
  NOTION_MCP_URL?: string;
  NOTION_MCP_API_KEY?: string;
  MCP_CONFIG_PATH?: string;
  LOG_MAX_SIZE?: string;
  LOG_MAX_FILES?: string;
  LOG_DIRECTORY?: string;
  LOG_DEBUG_TO_FILE?: string;
  LOG_TRACE_TO_FILE?: string;
}

// 環境変数のバリデーション
const validateEnv = (): EnvironmentVariables => {
  const requiredEnvVars: (keyof EnvironmentVariables)[] = ['DISCORD_TOKEN', 'OPENAI_API_KEY'];
  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    throw new Error(
      `以下の環境変数が設定されていません: ${missingEnvVars.join(', ')}`
    );
  }

  return {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    NODE_ENV: (process.env.NODE_ENV as EnvironmentVariables['NODE_ENV']) || 'development',
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

export const env = validateEnv();