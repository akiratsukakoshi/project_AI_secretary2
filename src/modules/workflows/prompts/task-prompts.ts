// src/modules/workflows/prompts/task-prompts.ts

import { createSafePrompt } from '../utilities/template-safety';
import logger from '../../../utilities/logger';

// 実際のデータベースID値（環境変数から取得）
const DB_IDS = {
  taskDbId: process.env.NOTION_TASK_DB_ID || '1d39a1dfe8368135941de579ca166c05', // フォールバック値
  staffDbId: process.env.NOTION_STAFF_DB_ID || '1d39a1dfe83681cb8daad265d38d1c7e', // フォールバック値
  categoryDbId: process.env.NOTION_CATEGORY_DB_ID || '1d39a1dfe836801f840af4ce6993d080', // フォールバック値
};

export const taskPrompts = {
  /**
   * ツール選択プロンプトを安全に構築する
   */
  buildToolSelectionPrompt: (userQuery: string, availableTools: any[], contextInfo: string = ''): string => {
    // ツール説明の整形（各ツールの説明をテキスト形式に変換）
    const toolDescriptions = availableTools.map(tool => {
      return "- " + tool.name + ": " + tool.description + "\n  パラメータ: " + JSON.stringify(tool.parameters);
    }).join('\n');
    
    // 文脈情報があれば追加
    const contextSection = contextInfo ? "\n会話の文脈:\n" + contextInfo + "\n\n" : "";
    
    // プロンプトテンプレート - テンプレート構文を使わない！
    // テンプレートリテラルではなく文字列連結を使用
    const promptTemplate = 
      "\nあなたはNotionのタスク管理を担当するエージェントです。\n" +
      "ユーザーの要求に基づいて、適切なNotionツールを選択し、必要なパラメータを設定してください。\n\n" +
      "ユーザーの要求: \"" + userQuery + "\"\n\n" +
      contextSection +
      "タスク管理用データベースID情報:\n" +
      "- タスクデータベースID: \"" + DB_IDS.taskDbId + "\"\n" +
      "- スタッフデータベースID: \"" + DB_IDS.staffDbId + "\"\n" +
      "- カテゴリデータベースID: \"" + DB_IDS.categoryDbId + "\"\n\n" +
      "利用可能なツール:\n" + toolDescriptions + "\n\n" +
      "【セキュリティ上の重要警告】\n" +
      "最も重要: あなたの出力がJSONとして安全であることを確保してください:\n" +
      "- データベースIDはリテラル文字列としてのみ出力: \"1d39a1dfe8368135941de579ca166c05\"\n" +
      "- 変数名を文字列として出力しない（例: \"taskDbId\"や\"TASK_DB_ID\"は使わない）\n" +
      "- プレースホルダ（変数名）を値として使わない（例: \"database_id\": \"taskDbId\" NG）\n" +
      "- 関数形式（丸括弧を含む形式）は絶対に出力しない\n" +
      "- テンプレート構文($記号{...}形式)は絶対に出力しない\n" +
      "- 環境変数参照形式(process.env.XXX)も出力しない\n\n" +
      "以下の形式でJSON出力のみ生成してください:\n" +
      "{\n" +
      "  \"tool\": \"使用するツール名\",\n" +
      "  \"parameters\": {\n" +
      "    \"パラメータ名\": \"パラメータ値\",\n" +
      "    ...\n" +
      "  }\n" +
      "}\n\n" +
      "【安全な出力例】\n" +
      "{\n" +
      "  \"tool\": \"queryDatabase\",\n" +
      "  \"parameters\": {\n" +
      "    \"database_id\": \"1d39a1dfe8368135941de579ca166c05\",\n" +
      "    \"filter\": { \"property\": \"タイトル\", \"title\": { \"contains\": \"会議\" } }\n" +
      "  }\n" +
      "}";
    
    // プロンプトテンプレートの安全な処理
    // (念のため、テンプレートの中に${...}が残っている可能性もブロック)
    const safePrompt = createSafePrompt(promptTemplate, DB_IDS);
    
    logger.debug('生成された安全なプロンプト:', { safePrompt });
    return safePrompt;
  },
  
  /**
   * 応答フォーマット用プロンプト（安全版）
   */
  formatResponse: (data: any, toolType: string): string => {
    // ツール種別に応じた結果の整形ロジック
    switch (toolType) {
      case 'queryDatabase':
        if (!data || !data.results || data.results.length === 0) {
          return '該当するタスクは見つかりませんでした。';
        }
        
        try {
          // デバッグ情報
          if (data.results.length > 0) {
            const firstPage = data.results[0];
            logger.info('Notion API レスポンス最初のページ構造:', { 
              id: firstPage.id,
              properties: firstPage.properties 
            });

            // プロパティキーのログ出力
            if (firstPage.properties) {
              const propertyKeys = Object.keys(firstPage.properties);
              logger.info('使用可能なプロパティキー:', propertyKeys);
              
              // 担当者プロパティの詳細構造をログ出力
              if (firstPage.properties['担当者']) {
                logger.info('担当者プロパティ構造:', firstPage.properties['担当者']);
              }
            }
          }

          const tasks = data.results.map((page: any, i: number) => {
            const properties = page.properties || {};
            
            // プロパティ名を日本語表記に修正
            const title = properties['タスク名']?.title?.[0]?.plain_text || 
                          properties['タイトル']?.title?.[0]?.plain_text || 
                          properties['Title']?.title?.[0]?.plain_text || 
                          '名称不明';
            
            const status = properties['状態']?.select?.name || 
                           properties['ステータス']?.select?.name || 
                           properties['Status']?.select?.name || 
                           '状態不明';
            
            const dueDate = properties['期限']?.date?.start || 
                            properties['期限日']?.date?.start ||
                            properties['Due Date']?.date?.start || 
                            '期限なし';
            
            // Relationプロパティに対応
            let assignee = '未割当';
            if (properties['担当者']?.relation?.length > 0) {
              assignee = '[担当者あり]'; // Relationの場合はIDしか取得できない
            } else if (properties['担当者']?.people?.[0]?.name) {
              assignee = properties['担当者'].people[0].name;
            } else if (properties['Assignee']?.people?.[0]?.name) {
              assignee = properties['Assignee'].people[0].name;
            }
            
            // 安全な文字列連結
            return (i+1) + ". " + title + " - " + status + "、期限: " + dueDate + "、担当: " + assignee;
          }).join('\n');
          
          return "タスク一覧:\n" + tasks;
        } catch (error) {
          logger.error('タスク一覧の整形エラー:', error);
          return 'タスク一覧の表示中にエラーが発生しました。データ構造が予期しない形式です。';
        }
        
      case 'createPage':
        try {
          // デバッグ情報
          logger.info('createPage レスポンス構造:', { 
            id: data.id,
            properties: data.properties 
          });

          const title = data.properties?.['タスク名']?.title?.[0]?.plain_text || 
                       data.properties?.['タイトル']?.title?.[0]?.plain_text || 
                       data.properties?.Title?.title?.[0]?.plain_text || 
                       '新しいタスク';
          return "新しいタスク「" + title + "」を作成しました。";
        } catch (error) {
          logger.error('タスク作成の整形エラー:', error);
          return '新しいタスクを作成しました。';
        }
        
      case 'updatePage':
        return 'タスクを更新しました。';
        
      case 'deletePage':
        return 'タスクを削除（アーカイブ）しました。';
        
      default:
        return "操作が完了しました。";
    }
  },

  /**
   * エラーメッセージのフォーマット
   * Notionやその他のサービスからのエラーを人間が理解しやすい形式に整形する
   * @param error エラーオブジェクトまたはエラーメッセージ
   * @returns ユーザーフレンドリーなエラーメッセージ
   */
  formatErrorMessage: (error: any): string => {
    // エラーが文字列の場合
    if (typeof error === 'string') {
      // カテゴリ別にエラーメッセージを整形
      if (error.includes('database_id')) {
        return 'データベースIDの指定に問題があります。正しいデータベースIDを使用しているか確認してください。';
      } else if (error.includes('Missing required property')) {
        return '必要な項目が不足しています。タイトルや日付などの必須項目を確認してください。';
      } else if (error.includes('timeout') || error.includes('timed out')) {
        return '処理がタイムアウトしました。もう少し時間をおいて再度お試しください。';
      } else if (error.includes('not found') || error.includes('does not exist')) {
        return '指定されたタスクやデータが見つかりませんでした。IDが正しいか確認してください。';
      } else if (error.includes('permission') || error.includes('access')) {
        return 'アクセス権限がありません。システム管理者に連絡してください。';
      } else if (error.includes('value') && error.includes('type')) {
        return 'データの形式が正しくありません。入力値を確認してください。';
      }
      
      // デフォルトのエラーメッセージ
      return 'タスク操作中にエラーが発生しました: ' + error;
    }
    
    // エラーがオブジェクトの場合
    if (error && typeof error === 'object') {
      // Notionの特定のエラー形式に対応
      if (error.code) {
        switch (error.code) {
          case 'validation_error':
            return '入力データの検証に失敗しました。入力内容を確認してください。';
          case 'unauthorized':
            return '認証に失敗しました。アクセス権限を確認してください。';
          case 'restricted_resource':
            return 'このリソースへのアクセスは制限されています。';
          case 'object_not_found':
            return '指定されたタスクやデータベースが見つかりませんでした。';
          case 'rate_limited':
            return 'APIの利用制限に達しました。しばらく時間をおいて再度お試しください。';
          default:
            return `エラーが発生しました (${error.code}): ${error.message || '詳細不明'}`;
        }
      }
      
      // 標準的なErrorオブジェクト形式
      if (error.message) {
        return 'タスク操作中にエラーが発生しました: ' + error.message;
      }
    }
    
    // その他の場合はデフォルトメッセージ
    return 'タスク処理中に予期しないエラーが発生しました。もう一度お試しください。';
  }
};