// Discord Bot の基本機能
import { Client, GatewayIntentBits, Events, Message } from 'discord.js';
import openaiService from './services/openai-service';
import memoryService from './services/memory-service';
import logger from './utilities/logger';
import { env } from './config/env';
import { setupGlobalErrorHandlers } from './utilities/error-handler';
import { testRAGConnection } from './modules/rag/rag-test';
import discordRagIntegration from './modules/rag/discordRagIntegration';

// ワークフローモジュールをインポート
import { 
  WorkflowManager, 
  workflowRegistry, 
  calendarWorkflow,
  taskWorkflow,
  GoogleCalendarMCPConnector,
  NotionMCPConnector,
  OpenAIClient
} from './modules/workflows';

// グローバルエラーハンドラーのセットアップ
setupGlobalErrorHandlers();

// ワークフローマネージャーの初期化
const llmClient = new OpenAIClient(env.OPENAI_API_KEY);

// サービスコネクタの初期化
const serviceConnectors = new Map();

// Google Calendar MCPコネクタの設定
// Claude Code MCPを使用する場合はenv.MCP_CONFIG_PATHを使用
// API接続モードを使用する場合はenv.GOOGLE_CALENDAR_MCP_URLとenv.GOOGLE_CALENDAR_MCP_API_KEYを使用
const googleCalendarConnector = new GoogleCalendarMCPConnector(
  env.GOOGLE_CALENDAR_MCP_URL,          // API接続モードのURL（MCPモードでは不要）
  env.GOOGLE_CALENDAR_MCP_API_KEY,      // API接続モードのAPIキー（MCPモードでは不要）
  true,                                 // Claude Code MCPを使用するかどうか（デフォルトtrue）
  env.MCP_CONFIG_PATH                   // MCP設定ファイルのパス
);
serviceConnectors.set('google-calendar', googleCalendarConnector);

// Notion MCPコネクタの設定
// APIサーバーモードを優先（API URL指定済みでAPIサーバー常駐モード）
// フォールバックとしてClaude Code MCPも設定（true）
const notionConnector = new NotionMCPConnector(
  env.NOTION_MCP_URL,                   // API接続モードのURL
  env.NOTION_MCP_API_KEY,               // API接続モードのAPIキー
  true,                                 // フォールバック：Claude Code MCPを使用可能に
  env.MCP_CONFIG_PATH                   // MCP設定ファイルのパス
);
serviceConnectors.set('notion-mcp', notionConnector);

// ワークフローマネージャーの初期化
const workflowManager = new WorkflowManager(
  env.OPENAI_API_KEY,
  serviceConnectors
);

// カレンダーワークフローの登録
workflowRegistry.registerWorkflow(calendarWorkflow);

// タスク管理ワークフローの登録
workflowRegistry.registerWorkflow(taskWorkflow);

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
    
    // タスクAPIテスト
    if (prompt.toLowerCase() === 'task-test' || prompt.toLowerCase() === 'taskテスト' || prompt.toLowerCase() === 'タスクテスト') {
      await handleTaskTest(message);
      return;
    }
    
    try {
      // 「考え中...」メッセージを表示
      const typingMessage = await (message.channel as any).send({ content: '考え中...' });
      
      // ワークフローマネージャーで処理を試みる
      const workflowResult = await workflowManager.processMessage({
        content: prompt,
        userId: message.author.id,
        channelId: message.channel.id,
        messageId: message.id
      });
      
      // ワークフローで処理できた場合
      if (workflowResult) {
        // 「考え中...」メッセージを削除
        await typingMessage.delete();
        
        logger.info(`ワークフロー「${workflowResult.data?.workflowId || 'unknown'}」を実行しました`);
        
        // 応答を送信
        message.reply({ content: workflowResult.message });
        return;
      }
      
      // ワークフローで処理できなかった場合、RAG処理へフォールバック
      logger.info('ワークフローでの処理なし、RAG処理へフォールバック');
      
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

/**
 * タスク管理APIの接続テストを実行するハンドラー
 */
async function handleTaskTest(message: Message): Promise<void> {
  try {
    logger.info(`ユーザー ${message.author.tag} からのタスクAPIテストリクエスト`);
    
    // テスト開始メッセージ
    const processingMessage = await message.reply({ content: 'Notion APIサーバー接続テストを実行しています... ⏳' });
    
    // NotionMCPコネクタの取得
    const notionConnector = serviceConnectors.get('notion-mcp') as NotionMCPConnector;
    if (!notionConnector) {
      throw new Error('NotionMCPコネクタが初期化されていません');
    }
    
    // 利用可能なツール一覧を取得
    const tools = await notionConnector.getAvailableTools();
    
    // タスク一覧の取得をテスト
    const testResult = await notionConnector.getTasks({ status: '未着手' });
    
    // テスト結果の整形
    let resultMessage = '✅ Notion MCPサーバー接続テスト完了\n\n';
    resultMessage += `【利用可能なツール】${tools.length}件\n`;
    tools.forEach((tool, index) => {
      resultMessage += `${index + 1}. ${tool.name}: ${tool.description}\n`;
    });
    
    resultMessage += '\n【タスク取得テスト】\n';
    if (testResult.success) {
      const tasks = testResult.data?.items || [];
      resultMessage += `取得結果: ${tasks.length}件のタスクが見つかりました\n`;
      if (tasks.length > 0) {
        resultMessage += '最初の3件:\n';
        tasks.slice(0, 3).forEach((task: any, index: number) => {
          resultMessage += `${index + 1}. ${task.title || 'タイトルなし'}\n`;
        });
      }
    } else {
      resultMessage += `エラー: ${testResult.error}\n`;
    }
    
    // テスト結果を送信
    await processingMessage.edit(resultMessage);
    
    logger.info('タスクAPIテスト完了');
  } catch (error) {
    logger.error('タスクAPIテスト実行エラー:', error);
    message.reply({ content: `タスクAPIテストの実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` });
  }
}

// Discord Bot ログイン
client.login(env.DISCORD_TOKEN).catch((error) => {
  logger.error('Discord ログインエラー:', error);
  process.exit(1);
});
