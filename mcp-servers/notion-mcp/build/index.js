"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// .env ファイルから環境変数を読み込む（この行より後のコードで process.env が使えるようになる
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const callTool_1 = require("./handlers/callTool");
const listTools_1 = require("./handlers/listTools");
const notionClient_1 = require("./services/notionClient");
// 環境変数のログ出力
console.log('=================== 環境変数設定状況 ===================');
console.log(`NOTION_MCP_API_KEY: ${process.env.NOTION_MCP_API_KEY ? '設定済み (長さ: ' + process.env.NOTION_MCP_API_KEY.length + ')' : '未設定'}`);
console.log(`NOTION_TOKEN: ${process.env.NOTION_TOKEN ? '設定済み (長さ: ' + process.env.NOTION_TOKEN.length + ')' : '未設定'}`);
console.log(`NOTION_VERSION: ${process.env.NOTION_VERSION || '未設定 (デフォルト: 2022-06-28)'}`);
console.log('=======================================================');
// APIサーバー設定
const app = (0, express_1.default)();
app.use(express_1.default.json({
    limit: '5mb' // 大きめのリクエストボディを許可
}));
app.use((0, cors_1.default)());
// リクエストロギングミドルウェア
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// APIエンドポイント
app.get('/api/tools', listTools_1.listToolsHandler);
app.post('/api/tools/:tool', callTool_1.callToolHandler);
// ヘルスチェックエンドポイント（詳細情報付き）
app.get('/health', (req, res) => {
    const healthCheck = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: {
            NODE_ENV: process.env.NODE_ENV || 'development',
            notionApiKey: process.env.NOTION_MCP_API_KEY ? '設定済み' : '未設定',
            notionToken: process.env.NOTION_TOKEN ? '設定済み' : '未設定',
            notionVersion: process.env.NOTION_VERSION || '2022-06-28'
        },
        serverInfo: {
            uptime: process.uptime()
        }
    };
    res.json(healthCheck);
});
// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
    console.error('サーバーエラー:', err);
    res.status(500).json({
        error: 'サーバー内部エラー',
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
});
// 未処理の例外をキャッチ
process.on('uncaughtException', (err) => {
    console.error('未処理の例外が発生しました:', err);
    // サーバーをクラッシュさせないが、ログに記録する
});
// Promiseの拒否をキャッチ
process.on('unhandledRejection', (reason, promise) => {
    console.error('未処理のPromise拒否が発生しました:', reason);
    // サーバーをクラッシュさせないが、ログに記録する
});
// サーバー起動
const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Notion MCPサーバーが起動しました: http://localhost:${PORT} (0.0.0.0:${PORT})`);
    // APIキーの詳細なログ
    if (process.env.NOTION_MCP_API_KEY) {
        console.log(`APIキー (NOTION_MCP_API_KEY) の形式: ${process.env.NOTION_MCP_API_KEY.substring(0, 6)}...${process.env.NOTION_MCP_API_KEY.substring(process.env.NOTION_MCP_API_KEY.length - 4)}`);
    }
    else if (process.env.NOTION_TOKEN) {
        console.log(`APIキー (NOTION_TOKEN) の形式: ${process.env.NOTION_TOKEN.substring(0, 6)}...${process.env.NOTION_TOKEN.substring(process.env.NOTION_TOKEN.length - 4)}`);
    }
    else {
        console.error('APIキーが設定されていません。Notion APIへのリクエストは失敗します。');
    }
    // ネットワーク情報の表示
    try {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        console.log('ネットワークインターフェース情報:');
        Object.keys(networkInterfaces).forEach((ifName) => {
            networkInterfaces[ifName].forEach((iface) => {
                // IPv4アドレスのみ表示
                if (iface.family === 'IPv4') {
                    console.log(`  ${ifName}: ${iface.address}`);
                }
            });
        });
    }
    catch (err) {
        console.error('ネットワーク情報の取得に失敗:', err);
    }
    // Notionクライアントの接続確認
    console.log('Notionクライアントの接続確認を試みます...');
    // 簡易的な接続テスト - APIキーが正しく設定されているか確認
    (async () => {
        try {
            // ダミークエリでAPIの応答をテスト
            const response = await notionClient_1.notionClient.users.me({});
            console.log('Notion APIに接続成功! ユーザー:', response.name || 'ユーザー名不明');
        }
        catch (error) {
            console.error('Notion API接続テストに失敗:', {
                error: error.message,
                code: error.code,
                status: error.status
            });
            console.error('認証情報を確認してください。Notion APIに正しく接続できていません。');
        }
    })();
});
