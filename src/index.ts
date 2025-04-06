// Discord Bot の基本機能
import { Client, GatewayIntentBits, Events, Message } from 'discord.js';
import openaiService from './services/openai-service';
import memoryService from './services/memory-service';
import logger from './utilities/logger';
import { env } from './config/env';
import { setupGlobalErrorHandlers } from './utilities/error-handler';
import { testRAGConnection } from './modules/rag/rag-test';

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
      message.reply('こんにちは！AI秘書「ガクコ」です。何かお手伝いできることはありますか？');
      return;
    }

    // 特別なコマンドチェック
    if (prompt.toLowerCase() === 'rag-test' || prompt.toLowerCase() === 'ragテスト') {
      await handleRAGTest(message);
      return;
    }
    
    try {
      // 入力メッセージを会話履歴に追加
      await memoryService.addMessage(
        message.author.id,
        message.channel.id,
        {
          role: 'user',
          content: prompt,
          timestamp: new Date()
        }
      );
      
      // 会話履歴を取得
      const context = await memoryService.getConversation(
        message.author.id,
        message.channel.id
      );
      
      // AIからの応答を取得
      logger.debug(`ユーザー入力: ${prompt}`);
      const typingMessage = await message.channel.send('考え中...');
      const aiResponse = await openaiService.generateResponse(prompt, context.messages);
      await typingMessage.delete();
      
      // 応答を会話履歴に追加
      await memoryService.addMessage(
        message.author.id,
        message.channel.id,
        {
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date()
        }
      );
      
      logger.debug(`AI応答: ${aiResponse.substring(0, 50)}...`);
      message.reply(aiResponse);
    } catch (error) {
      logger.error('エラーが発生しました:', error);
      message.reply('処理中にエラーが発生しました。もう一度お試しください。');
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
    const processingMessage = await message.reply('RAGシステムの接続テストを実行しています... ⏳');
    
    // テスト実行
    const testResult = await testRAGConnection();
    
    // テスト結果を送信
    await processingMessage.edit(`${testResult}`);
    
    logger.info('RAGテスト完了');
  } catch (error) {
    logger.error('RAGテスト実行エラー:', error);
    message.reply('RAGテストの実行中にエラーが発生しました。詳細はログを確認してください。');
  }
}

// Discord Bot ログイン
client.login(env.DISCORD_TOKEN).catch((error) => {
  logger.error('Discord ログインエラー:', error);
  process.exit(1);
});