import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

class OpenAIEmbeddingsService {
  private openai: OpenAI;
  private embeddingModel: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API キーが設定されていません');
    }
    
    this.openai = new OpenAI({
      apiKey,
    });
    
    // デフォルトで最新の埋め込みモデルを使用
    this.embeddingModel = 'text-embedding-3-small';
  }

  /**
   * テキストの埋め込みベクトルを生成
   * @param text 埋め込みを生成するテキスト
   * @returns 埋め込みベクトル
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text.trim()
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('埋め込み生成エラー:', error);
      throw new Error('テキストの埋め込み生成中にエラーが発生しました');
    }
  }

  /**
   * 複数のテキストに対する埋め込みベクトルをバッチ処理で生成
   * @param texts 埋め込みを生成するテキストの配列
   * @returns 埋め込みベクトルの配列
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // 空の文字列を除去
      const validTexts = texts.filter(text => text.trim().length > 0);
      
      if (validTexts.length === 0) {
        return [];
      }
      
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: validTexts.map(text => text.trim())
      });
      
      // レスポンスから埋め込みを取得して順序を保持
      return response.data.sort((a, b) => a.index - b.index).map(item => item.embedding);
    } catch (error) {
      console.error('バッチ埋め込み生成エラー:', error);
      throw new Error('複数テキストの埋め込み生成中にエラーが発生しました');
    }
  }

  /**
   * 埋め込みモデルを設定
   * @param modelName 使用する埋め込みモデル名
   */
  setEmbeddingModel(modelName: string): void {
    this.embeddingModel = modelName;
  }
}

export default new OpenAIEmbeddingsService();
