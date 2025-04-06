// Discord Bot の基本機能
import { Client, GatewayIntentBits, Events, Message } from 'discord.js';
import openaiService from './services/openai-service';
import memoryService from './services/memory-service';
import logger from './utilities/logger';
import { env } from './config/env';
import { setupGlobalErrorHandlers } from './utilities/error-handler';
import { testRAGConnection } from './modules/rag/rag-test';
import discordRagIntegration from './modules/rag/discordRagIntegration';

// グローバルエラーハンドラーのセットアップ
setupGlobalErrorHandlers();

// Discord クライアントの初期化
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Bot が準備完了した時のイベント
client.once(Events.ClientReady, (readyClient) => {
  logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
});

// メッセージ受信時のイベント
client.on(Events.MessageCreate, async (message: Message) => {
  // Bot のメッセージは無視
  if (message.author.bot) return;

  // ガクコの呼び出し方法を拡張
  // 1. プレフィックス `!ai`
  // 2. メンション
  // 3. 「ガクコ」という名前を含む
  const isMentioned = message.mentions.users.has(client.user?.id || '');
  const hasPrefix = message.content.startsWith('!ai');
  const hasName = message.content.toLowerCase().includes('ガクコ') || 
                 message.content.toLowerCase().includes('がくこ') ||
                 message.content.toLowerCase().includes('gakuco');

  if (isMentioned || hasPrefix || hasName) {
    let prompt = message.content;
    
    // プレフィックスの除去
    if (hasPrefix) {
      prompt = message.content.slice(3).trim();
    }
    
    // 空のプロンプトチェック
    if (prompt.trim().length === 0) {
      message.reply({ content: 'こんにちは！AI秘書「ガクコ」です。何かお手伝いできることはありますか？' });
      return;
    }

    // 特別なコマンドチェック
    if (prompt.toLowerCase() === 'rag-test' || prompt.toLowerCase() === 'ragテスト') {
      await handleRAGTest(message);
      return;
    }
    
    try {
      // 「考え中...」メッセージを表示
      const typingMessage = await (message.channel as any).send({ content: '考え中...' });
      
      // DiscordBot-RAG統合モジュールでメッセージを処理
      const { response, usedRag } = await discordRagIntegration.processMessage(message, prompt);
      
      // 「考え中...」メッセージを削除
      await typingMessage.delete();
      
      // RAGを使用したかどうかをログに記録
      if (usedRag) {
        logger.info(`RAGを使用した応答を生成しました: ${response.substring(0, 50)}...`);
      } else {
        logger.info(`通常応答を生成しました: ${response.substring(0, 50)}...`);
      }
      
      // 応答を送信
      message.reply({ content: response });
    } catch (error) {
      logger.error('エラーが発生しました:', error);
      message.reply({ content: '処理中にエラーが発生しました。もう一度お試しください。' });
    }
  }
});

/**
 * RAGシステムのテストを実行するハンドラー
 */
async function handleRAGTest(message: Message): Promise<void> {
  try {
    logger.info(`ユーザー ${message.author.tag} からのRAGテストリクエスト`);
    
    // テスト開始メッセージ
    const processingMessage = await message.reply({ content: 'RAGシステムの接続テストを実行しています... ⏳' });
    
    // テスト実行
    const testResult = await testRAGConnection();
    
    // テスト結果を送信
    await processingMessage.edit(`${testResult}`);
    
    logger.info('RAGテスト完了');
  } catch (error) {
    logger.error('RAGテスト実行エラー:', error);
    message.reply({ content: 'RAGテストの実行中にエラーが発生しました。詳細はログを確認してください。' });
  }
}

// Discord Bot ログイン
client.login(env.DISCORD_TOKEN).catch((error) => {
  logger.error('Discord ログインエラー:', error);
  process.exit(1);
});