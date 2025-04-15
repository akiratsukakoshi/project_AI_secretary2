"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listToolsHandler = void 0;
const listToolsHandler = (req, res) => {
    const tools = [
        {
            name: 'queryDatabase',
            description: 'Notionデータベースをクエリして結果を取得します',
            parameters: {
                database_id: {
                    type: 'string',
                    description: 'クエリするデータベースのID'
                },
                filter: {
                    type: 'object',
                    description: 'クエリのフィルター条件（オプション）'
                },
                sorts: {
                    type: 'array',
                    description: 'クエリの並び替え条件（オプション）'
                }
            }
        },
        {
            name: 'createPage',
            description: 'Notionに新しいページを作成します',
            parameters: {
                parent: {
                    type: 'object',
                    description: '親データベース情報 (例: { database_id: "xxx" })'
                },
                properties: {
                    type: 'object',
                    description: 'ページのプロパティ'
                },
                children: {
                    type: 'array',
                    description: 'ページの子ブロック（オプション）'
                }
            }
        },
        {
            name: 'updatePage',
            description: '既存のNotionページを更新します',
            parameters: {
                page_id: {
                    type: 'string',
                    description: '更新するページのID'
                },
                properties: {
                    type: 'object',
                    description: '更新するプロパティ'
                }
            }
        },
        {
            name: 'deletePage',
            description: 'Notionのページをアーカイブ（削除）します',
            parameters: {
                page_id: {
                    type: 'string',
                    description: '削除するページのID'
                }
            }
        },
        {
            name: 'retrievePage',
            description: 'Notionページの詳細を取得します',
            parameters: {
                page_id: {
                    type: 'string',
                    description: '取得するページのID'
                }
            }
        },
        {
            name: 'retrieveDatabase',
            description: 'Notionデータベースの詳細を取得します',
            parameters: {
                database_id: {
                    type: 'string',
                    description: '取得するデータベースのID'
                }
            }
        }
    ];
    res.json(tools);
};
exports.listToolsHandler = listToolsHandler;
