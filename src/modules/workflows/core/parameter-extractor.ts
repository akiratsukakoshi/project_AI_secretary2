import { ParamSchema } from './workflow-types';
import logger from '../../../utilities/logger';
import { parseDate } from '../../../utilities/date/date-parser';
import { OpenAI } from 'openai';

/**
 * ワークフローパラメータ抽出クラス
 * ユーザーの入力からワークフローのパラメータを抽出する
 */
export class ParameterExtractor {
  private openai: OpenAI;

  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey
    });
  }

  /**
   * LLMを使用してパラメータを抽出
   * @param message ユーザーメッセージ
   * @param schema パラメータスキーマ
   * @returns 抽出されたパラメータ
   */
  async extractParameters(message: string, schema: ParamSchema): Promise<Record<string, any>> {
    // LLMプロンプトの構築
    const prompt = this.buildExtractionPrompt(message, schema);

    try {
      // OpenAI APIを呼び出し
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: "あなたはAI秘書「ガクコ」のパラメータ抽出コンポーネントです。" },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      // 応答のJSONをパース
      const content = response.choices[0].message.content;
      if (!content) {
        logger.error("Parameter extraction failed: Empty response from OpenAI");
        return {};
      }

      try {
        const params = JSON.parse(content);
        return this.validateAndTransformParameters(params, schema);
      } catch (parseError) {
        logger.error("Parameter extraction failed: Invalid JSON response", parseError);
        return {};
      }
    } catch (error) {
      logger.error("Parameter extraction failed", error);
      return {};
    }
  }

  /**
   * パラメータ抽出用のプロンプトを構築
   * @param message ユーザーメッセージ
   * @param schema パラメータスキーマ
   * @returns 構築されたプロンプト
   */
  private buildExtractionPrompt(message: string, schema: ParamSchema): string {
    const schemaDescription = Object.entries(schema)
      .map(([key, def]) => {
        const requiredMark = def.required ? '（必須）' : '（省略可）';
        return `- ${key} ${requiredMark}: ${def.description} [型: ${def.type}]`;
      })
      .join('\n');

    return `
ユーザーの入力からワークフローの実行に必要なパラメータを抽出してください。

必要なパラメータ:
${schemaDescription}

ユーザー入力:
"""
${message}
"""

以下の形式でJSONオブジェクトとして結果を返してください:
{
  "パラメータ名": 抽出した値,
  ...
}

注意:
- 明示的に言及されていないパラメータは null を設定してください
- 日付や時間の表現は適切な形式で抽出してください（例: "2023-04-01", "15:30"）
- 複数の候補がある場合は最も確からしいものを選択してください
- パラメータがユーザー入力に存在しない場合は null を設定してください
`;
  }

  /**
   * 抽出されたパラメータを検証し変換する
   * @param params 抽出されたパラメータ
   * @param schema パラメータスキーマ
   * @returns 検証・変換されたパラメータ
   */
  private validateAndTransformParameters(
    params: Record<string, any>,
    schema: ParamSchema
  ): Record<string, any> {
    const result: Record<string, any> = {};

    // スキーマの各フィールドを処理
    for (const [key, def] of Object.entries(schema)) {
      let value = params[key];

      // 必須パラメータのチェック
      if (def.required && (value === null || value === undefined)) {
        logger.warn(`Required parameter '${key}' is missing`);
        // デフォルト値があればそれを使う
        if ('default' in def) {
          value = def.default;
        }
      }

      // 型変換
      if (value !== null && value !== undefined) {
        try {
          switch (def.type) {
            case 'string':
              value = String(value);
              break;
            case 'number':
              value = Number(value);
              if (isNaN(value)) {
                logger.warn(`Invalid number format for parameter '${key}': ${value}`);
                value = null;
              }
              break;
            case 'boolean':
              if (typeof value === 'string') {
                value = value.toLowerCase() === 'true' || value === '1';
              } else {
                value = Boolean(value);
              }
              break;
            case 'date':
              if (typeof value === 'string') {
                // 日付解析
                const parsedDate = parseDate(value);
                if (parsedDate) {
                  value = parsedDate;
                } else {
                  logger.warn(`Invalid date format for parameter '${key}': ${value}`);
                  value = null;
                }
              } else if (value instanceof Date) {
                // 既にDateオブジェクト
              } else {
                logger.warn(`Unexpected date type for parameter '${key}': ${typeof value}`);
                value = null;
              }
              break;
            case 'array':
              if (!Array.isArray(value)) {
                if (typeof value === 'string') {
                  // カンマ区切りの文字列を配列に変換
                  value = value.split(',').map(item => item.trim());
                } else {
                  logger.warn(`Invalid array format for parameter '${key}': ${value}`);
                  value = null;
                }
              }
              break;
            case 'object':
              if (typeof value === 'string') {
                try {
                  value = JSON.parse(value);
                } catch (e) {
                  logger.warn(`Invalid object format for parameter '${key}': ${value}`);
                  value = null;
                }
              } else if (typeof value !== 'object') {
                logger.warn(`Invalid object type for parameter '${key}': ${typeof value}`);
                value = null;
              }
              break;
          }
        } catch (error) {
          logger.error(`Error converting parameter '${key}'`, error);
          value = null;
        }
      }

      // バリデータがある場合は実行
      if (value !== null && value !== undefined && def.validator) {
        try {
          if (!def.validator(value)) {
            logger.warn(`Validation failed for parameter '${key}': ${value}`);
            value = null;
          }
        } catch (error) {
          logger.error(`Error validating parameter '${key}'`, error);
          value = null;
        }
      }

      result[key] = value;
    }

    return result;
  }
}
