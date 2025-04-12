/**
 * ツール選択ロジック
 * ユーザークエリからLLMを使って最適なツールとパラメータを選択する
 */

import { LLMClient } from './llm-client';
import logger from '../../../utilities/logger';

export class ToolSelector {
  private llmClient: LLMClient;
  
  /**
   * コンストラクタ
   * @param llmClient LLMクライアント
   */
  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }
  
  /**
   * ユーザークエリに基づいて最適なツールとパラメータを選択
   * @param userQuery ユーザークエリ
   * @param availableTools 利用可能なツール一覧
   * @param contextInfo 追加コンテキスト情報
   * @returns 選択されたツールとパラメータ
   */
  async selectToolAndParameters(
    userQuery: string,
    availableTools: Array<{
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>,
    contextInfo?: string
  ): Promise<{
    tool: string;
    parameters: Record<string, any>;
    reasoning?: string;
  }> {
    if (!availableTools || availableTools.length === 0) {
      logger.warn('利用可能なツールが指定されていません');
      throw new Error('利用可能なツールがありません');
    }
    
    // ツール選択に使用するオプション
    const options = {
      contextInfo,
      temperature: 0.2, // 低い温度で一貫した選択に
    };
    
    // LLMクライアントを使用してツールとパラメータを選択
    logger.info(`ツール選択を実行: クエリ "${userQuery.substring(0, 50)}..."、利用可能なツール ${availableTools.length}個`);
    
    try {
      const result = await this.llmClient.selectToolAndParameters(
        userQuery,
        availableTools,
        options
      );
      
      logger.info(`ツール選択結果: ツール "${result.tool}"、パラメータ数 ${Object.keys(result.parameters || {}).length}個`);
      return result;
    } catch (error) {
      logger.error('ツール選択中にエラーが発生しました:', error);
      throw error;
    }
  }
  
  /**
   * ツール選択のためのレーティングを生成（数値評価）
   * 将来の拡張: ツール選択をより洗練するため、各ツールのレーティングを取得する
   * @param userQuery ユーザークエリ
   * @param availableTools 利用可能なツール一覧
   */
  async generateToolRatings(
    userQuery: string,
    availableTools: Array<{
      name: string;
      description: string;
    }>
  ): Promise<Record<string, number>> {
    // 将来の拡張のための準備
    // 現在は使用していない
    return {};
  }
}
