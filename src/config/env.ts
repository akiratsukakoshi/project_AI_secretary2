import dotenv from 'dotenv';
import path from 'path';

// 環境変数の読み込み
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface EnvironmentVariables {
  DISCORD_TOKEN: string;
  OPENAI_API_KEY: string;
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL?: string;
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
  };
};

export const env = validateEnv();