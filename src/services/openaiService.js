const OpenAI = require('openai');

// OpenAI クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * ユーザーメッセージからAIレスポンスを生成
 * @param {string} messageContent - ユーザーからのメッセージ内容
 * @returns {Promise<string>} - AIが生成したレスポンス
 */
async function generateResponse(messageContent) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `あなたはDiscordで動作するAI秘書です。ユーザーのタスク管理やスケジュール管理を支援します。
簡潔かつ丁寧な応答を心がけてください。必要に応じて機能を実行することができます。`
        },
        {
          role: "user",
          content: messageContent
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('OpenAI APIでエラーが発生しました');
  }
}

module.exports = {
  generateResponse
};
