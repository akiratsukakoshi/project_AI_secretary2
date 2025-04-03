const openaiService = require('../services/openaiService');
const utils = require('../utils/utils');

/**
 * メッセージを処理し、適切なレスポンスを返す
 * @param {string} messageContent - ユーザーからのメッセージ内容
 * @returns {Promise<string>} - AIからのレスポンス
 */
async function processMessage(messageContent) {
  // シンプルな処理のため、直接AIに投げる実装
  // 将来的には意図解析やモジュール呼び出しの機能を追加予定
  try {
    const response = await openaiService.generateResponse(messageContent);
    return response;
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('AIレスポンスの生成に失敗しました');
  }
}

module.exports = {
  processMessage
};
