import { Client } from '@notionhq/client';

// 環境変数から認証情報を取得
// APIキーの優先順位: NOTION_MCP_API_KEY > NOTION_TOKEN
const token = process.env.NOTION_MCP_API_KEY || process.env.NOTION_TOKEN;
const version = process.env.NOTION_VERSION || '2022-06-28';

if (!token) {
  console.warn('警告: NOTION_MCP_API_KEY または NOTION_TOKEN 環境変数が設定されていません');
  console.error('認証トークンが見つかりません。Notion APIへのリクエストは失敗します。');
} else {
  console.log(`Notionクライアント初期化: APIキー "${token.substring(0, 10)}..." を使用してクライアントを初期化します`);
}

// 詳細なデバッグ情報を出力
console.log(`環境変数: NOTION_MCP_API_KEY="${process.env.NOTION_MCP_API_KEY ? '設定済み' : '未設定'}", ` +
             `NOTION_TOKEN="${process.env.NOTION_TOKEN ? '設定済み' : '未設定'}", ` +
             `NOTION_VERSION="${version}"`);

// Notion クライアントの初期化
export const notionClient = new Client({
  auth: token,
  notionVersion: version
});
