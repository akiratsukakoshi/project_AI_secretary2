/**
 * 日時文字列をDateオブジェクトに変換する
 * @param {string} dateStr - 日時を表す文字列 (例: "2023-04-01 15:30", "明日の午後3時")
 * @returns {Date|null} - 日時オブジェクト、またはパース失敗時はnull
 */
function parseDateTime(dateStr) {
  // 将来的に自然言語の日時解析ロジックを実装予定
  try {
    // シンプルなISOフォーマット対応のパース
    const date = new Date(dateStr);
    if (\!isNaN(date.getTime())) {
      return date;
    }
    return null;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * 指定した形式で日時をフォーマットする
 * @param {Date} date - 日時オブジェクト
 * @param {string} format - 出力形式 ('short', 'medium', 'long')
 * @returns {string} - フォーマットされた日時文字列
 */
function formatDateTime(date, format = 'medium') {
  if (\!date) return '';
  
  const options = {
    short: { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    medium: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' }
  };
  
  return new Intl.DateTimeFormat('ja-JP', options[format]).format(date);
}

module.exports = {
  parseDateTime,
  formatDateTime
};
