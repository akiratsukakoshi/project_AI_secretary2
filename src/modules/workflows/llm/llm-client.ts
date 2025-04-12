/**
 * LLMクライアントインターフェースとその実装
 * v2.0: ツール選択とパラメータ抽出の機能を追加
 */

import { OpenAI } from 'openai';
import logger from '../../../utilities/logger';

/**
 * LLMからのレスポンスの型定義
 */
export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    parameters: Record<string, any>;
  }>;
}

/**
 * LLMクライアントインターフェース
 */
export interface LLMClient {
  /**
   * 標準的なレスポンス生成
   * @param prompt プロンプト
   * @param options オプション
   */
  generateResponse(prompt: string, options?: any): Promise<LLMResponse>;
  
  /**
   * 構造化されたレスポンス生成（JSON等）
   * @param prompt プロンプト
   * @param options オプション
   */
  generateStructuredResponse(prompt: string, options?: any): Promise<LLMResponse>;
  
  /**
   * ツール選択とパラメータ抽出
   * @param userQuery ユーザーのクエリ
   * @param availableTools 利用可能なツール一覧
   * @param options オプション
   */
  selectToolAndParameters(
    userQuery: string, 
    availableTools: Array<{
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>,
    options?: any
  ): Promise<{
    tool: string;
    parameters: Record<string, any>;
    reasoning?: string;
  }>;
}

/**
 * OpenAI APIを使用したLLMクライアント実装
 */
export class OpenAIClient implements LLMClient {
  private openai: OpenAI;
  private model: string;
  
  /**
   * コンストラクタ
   * @param apiKey OpenAI APIキー
   * @param model 使用するモデル名
   */
  constructor(apiKey: string, model: string = 'gpt-4-turbo') {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
    this.model = model;
  }
  
  /**
   * 標準的なレスポンス生成
   * @param prompt プロンプト
   * @param options オプション
   */
  async generateResponse(prompt: string, options?: any): Promise<LLMResponse> {
    try {
      logger.debug(`LLM リクエスト生成: ${prompt.substring(0, 50)}...`);
      const messages = [{
        role: 'user', content: prompt
      }];
      
      // システムメッセージがあれば追加
      if (options?.systemMessage) {
        messages.unshift({
          role: 'system',
          content: options.systemMessage
        });
      }
      
      // オプションのマージ
      const requestOptions = {
        model: options?.model || this.model,
        temperature: options?.temperature !== undefined ? options.temperature : 0.7,
        max_tokens: options?.maxTokens || 1000,
        ...options?.extraParams
      };
      
      const response = await this.openai.chat.completions.create({
        messages: messages as any,
        ...requestOptions
      });
      
      const content = response.choices[0].message.content || '';
      logger.debug(`LLM レスポンス: ${content.substring(0, 50)}...`);
      
      return {
        content
      };
    } catch (error) {
      logger.error('LLM レスポンス生成エラー:', error);
      throw error;
    }
  }
  
  /**
   * 構造化されたレスポンス生成（JSON等）
   * @param prompt プロンプト
   * @param options オプション
   */
  async generateStructuredResponse(prompt: string, options?: any): Promise<LLMResponse> {
    try {
      logger.debug(`構造化 LLM リクエスト: ${prompt.substring(0, 50)}...`);
      const messages = [{
        role: 'user', content: prompt
      }];
      
      // システムメッセージがあれば追加
      if (options?.systemMessage) {
        messages.unshift({
          role: 'system',
          content: options.systemMessage
        });
      }
      
      // オプションのマージ
      const requestOptions = {
        model: options?.model || this.model,
        temperature: options?.temperature !== undefined ? options.temperature : 0.2,
        max_tokens: options?.maxTokens || 1000,
        response_format: { type: "json_object" },
        ...options?.extraParams
      };
      
      const response = await this.openai.chat.completions.create({
        messages: messages as any,
        ...requestOptions
      });
      
      const content = response.choices[0].message.content || '';
      logger.debug(`構造化 LLM レスポンス: ${content.substring(0, 50)}...`);
      
      return {
        content
      };
    } catch (error) {
      logger.error('構造化 LLM レスポンス生成エラー:', error);
      throw error;
    }
  }
  
  /**
   * ツール選択とパラメータ抽出
   * @param userQuery ユーザーのクエリ
   * @param availableTools 利用可能なツール一覧
   * @param options オプション
   */
  async selectToolAndParameters(
    userQuery: string, 
    availableTools: Array<{
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>,
    options?: any
  ): Promise<{
    tool: string;
    parameters: Record<string, any>;
    reasoning?: string;
  }> {
    try {
      // ツール選択プロンプトの構築
      const toolDescriptions = availableTools.map(tool => {
        const paramsDescription = Object.entries(tool.parameters).map(
          ([name, desc]) => `    - ${name}: ${desc}`
        ).join('\n');
        
        return `- ${tool.name}: ${tool.description}\n  Parameters:\n${paramsDescription}`;
      }).join('\n\n');
      
      const customPrompt = options?.prompt;
      const prompt = customPrompt || `
あなたはユーザーの要求を理解し、適切なツールを選択するアシスタントです。
ユーザーの要求: "${userQuery}"

${options?.contextInfo ? `コンテキスト情報:\n${options.contextInfo}\n\n` : ''}
利用可能なツール:
${toolDescriptions}

これらのツールの中から、ユーザーの要求に最も適したツールを1つ選び、必要なパラメータを抽出または推測してください。
パラメータが不明確な場合は、文脈から最も合理的な値を推測してください。

JSON形式で出力:
{
  "tool": "選択したツール名",
  "parameters": {
    "パラメータ名": "パラメータ値",
    ...
  },
  "reasoning": "このツールを選んだ理由と、パラメータをどのように決定したか"
}`;
      
      // LLMによるツール選択を実行
      const response = await this.generateStructuredResponse(prompt, {
        systemMessage: "あなたはAI秘書ガクコのツール選択コンポーネントです。ユーザーの要求を分析し、最適なツールとパラメータを選択してください。",
        temperature: 0.2,
        ...options
      });
      
      // レスポンスのJSONをパース
      try {
        const result = JSON.parse(response.content);
        
        // 選択されたツールが存在するか確認
        const selectedTool = availableTools.find(tool => tool.name === result.tool);
        if (!selectedTool) {
          logger.warn(`選択されたツール "${result.tool}" は利用可能なツールに存在しません`);
          
          // 最初のツールをフォールバックとして使用
          if (availableTools.length > 0) {
            result.tool = availableTools[0].name;
            logger.info(`フォールバックツールを使用: ${result.tool}`);
          }
        }
        
        return {
          tool: result.tool,
          parameters: result.parameters || {},
          reasoning: result.reasoning
        };
      } catch (parseError: any) {
        logger.error('ツール選択レスポンスのJSONパースエラー:', parseError);
        throw new Error(`ツール選択レスポンスのJSONパースエラー: ${parseError.message}`);
      }
    } catch (error) {
      logger.error('ツール選択エラー:', error);
      
      // フォールバック: 最初のツールを選択
      if (availableTools.length > 0) {
        logger.info(`エラー発生のためフォールバックツールを使用: ${availableTools[0].name}`);
        return {
          tool: availableTools[0].name,
          parameters: {},
          reasoning: "エラーが発生したため、デフォルトツールを選択"
        };
      }
      
      throw error;
    }
  }
}
