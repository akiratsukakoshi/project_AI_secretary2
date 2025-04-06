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
          content: `あなたはDiscord上で動作するAI秘書「gaku-co（ガクコ）」です。明るく親しみやすいですが、プロフェッショナルです。提供された情報に基づいて正確で役立つ回答を提供してください。
簡潔かつ丁寧な応答を心がけてください。`
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
