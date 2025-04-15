"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callToolHandler = void 0;
const notionClient_1 = require("../services/notionClient");
const callToolHandler = async (req, res) => {
    try {
        // Authorizationヘッダーの検証
        const authHeader = req.headers.authorization;
        // 優先順位: NOTION_MCP_API_KEY > NOTION_TOKEN
        const apiKey = process.env.NOTION_MCP_API_KEY || process.env.NOTION_TOKEN;
        // API Keyが設定されている場合はヘッダーチェック
        if (apiKey && (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== apiKey)) {
            // 認証エラーのログと詳細情報
            console.error('認証エラー: API認証に失敗しました', {
                hasAuthHeader: !!authHeader,
                headerType: authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : '不明') : '無し',
                envApiKeyLength: apiKey ? apiKey.length : 0,
                headerKeyLength: authHeader ? authHeader.length - 7 : 0
            });
            // 認証失敗時はエラーを返す（セキュリティを強化）
            return res.status(401).json({
                error: '認証エラー: 無効なAPIキーが指定されています。正しい認証情報を指定してください。',
                auth_required: true
            });
        }
        const toolName = req.params.tool;
        const params = req.body;
        console.log(`ツール実行リクエスト: ${toolName}`, JSON.stringify(params, null, 2));
        // ツール名に基づいて処理を分岐
        try {
            switch (toolName) {
                case 'queryDatabase':
                    console.log(`queryDatabaseを実行します: database_id=${params.database_id}`, {
                        filter: params.filter,
                        sorts: params.sorts
                    });
                    const result = await notionClient_1.notionClient.databases.query({
                        database_id: params.database_id,
                        filter: params.filter,
                        sorts: params.sorts
                    });
                    console.log(`queryDatabase結果: ${result.results.length}件のレコード`);
                    return res.json(result);
                case 'createPage':
                    const newPage = await notionClient_1.notionClient.pages.create(params);
                    console.log(`createPage成功: page_id=${newPage.id}`);
                    return res.json(newPage);
                case 'updatePage':
                    const updatedPage = await notionClient_1.notionClient.pages.update({
                        page_id: params.page_id,
                        properties: params.properties
                    });
                    console.log(`updatePage成功: page_id=${updatedPage.id}`);
                    return res.json(updatedPage);
                case 'deletePage':
                    const deletedPage = await notionClient_1.notionClient.pages.update({
                        page_id: params.page_id,
                        archived: true
                    });
                    console.log(`deletePage成功: page_id=${deletedPage.id}`);
                    return res.json(deletedPage);
                case 'retrievePage':
                    const page = await notionClient_1.notionClient.pages.retrieve({
                        page_id: params.page_id
                    });
                    console.log(`retrievePage成功: page_id=${page.id}`);
                    return res.json(page);
                case 'retrieveDatabase':
                    const database = await notionClient_1.notionClient.databases.retrieve({
                        database_id: params.database_id
                    });
                    console.log(`retrieveDatabase成功: database_id=${database.id}`);
                    return res.json(database);
                default:
                    return res.status(404).json({
                        error: `サポートされていないツールです: ${toolName}`
                    });
            }
        }
        catch (notionError) {
            // Notion API特有のエラー処理
            console.error(`Notion API エラー (${toolName}):`, {
                error: notionError,
                code: notionError.code,
                status: notionError.status,
                message: notionError.message,
                params: JSON.stringify(params)
            });
            // Notion APIのエラーコードに応じたメッセージ作成
            let errorMessage = 'Notion API エラー';
            if (notionError.code) {
                // Notion APIのエラーコードに基づいたメッセージ
                switch (notionError.code) {
                    case 'unauthorized':
                        errorMessage = 'Notion API認証エラー: APIキーが無効か、アクセス権限がありません';
                        break;
                    case 'restricted_resource':
                        errorMessage = 'Notion APIリソースエラー: このリソースへのアクセスは制限されています';
                        break;
                    case 'object_not_found':
                        errorMessage = 'Notion APIエラー: 指定されたオブジェクトが見つかりません';
                        break;
                    case 'rate_limited':
                        errorMessage = 'Notion APIレート制限: APIの利用制限に達しました。しばらく時間をおいてください';
                        break;
                    case 'validation_error':
                        errorMessage = 'Notion API検証エラー: パラメータが無効です';
                        break;
                    default:
                        errorMessage = `Notion APIエラー (${notionError.code}): ${notionError.message}`;
                }
            }
            else if (notionError.message) {
                errorMessage = `Notion APIエラー: ${notionError.message}`;
            }
            return res.status(notionError.status || 500).json({
                error: errorMessage,
                tool: toolName,
                details: notionError.message
            });
        }
    }
    catch (error) {
        // 一般的なエラー処理
        console.error('ツール実行エラー:', error);
        // エラー詳細のログ記録を強化
        if (error instanceof Error) {
            console.error('エラー詳細:', {
                name: error.name,
                message: error.message,
                stack: error.stack?.split('\n')
                // TypeScript 4.5以降でサポートされるcauseプロパティはここでは使用しない
            });
        }
        // エラーメッセージの生成
        const errorMessage = error instanceof Error
            ? `ツール実行エラー: ${error.message}`
            : 'ツール実行中に不明なエラーが発生しました';
        return res.status(500).json({
            error: errorMessage,
            details: error instanceof Error ? error.message : '詳細不明'
        });
    }
};
exports.callToolHandler = callToolHandler;
