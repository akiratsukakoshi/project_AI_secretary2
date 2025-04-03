require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const botService = require('./bot/botService');

// Discord Client初期化
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// 起動時処理
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}\!`);
});

// メッセージ受信処理
client.on(Events.MessageCreate, async (message) => {
  // ボット自身のメッセージは無視
  if (message.author.bot) return;
  
  try {
    // メッセージを処理してレスポンスを取得
    const response = await botService.processMessage(message.content);
    
    // レスポンスを送信
    await message.channel.send(response);
  } catch (error) {
    console.error('Error processing message:', error);
    await message.channel.send('処理中にエラーが発生しました。しばらく経ってからもう一度お試しください。');
  }
});

// Discordへログイン
client.login(process.env.DISCORD_TOKEN)
  .catch(error => {
    console.error('Failed to login to Discord:', error);
    process.exit(1);
  });
