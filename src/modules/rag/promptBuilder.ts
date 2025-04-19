import retriever from './retriever';
import { SearchResult } from '../../interfaces/rag';

/**
 * RAGの検索結果を使用してLLMプロンプトを構築するクラス
 */
class PromptBuilder {
  // プロンプトテンプレート（カスタマイズ可能）
  private defaultSystemPrompt = `あなたはDiscord上で動作するAI秘書「gaku-co（ガクコ）」です。
ユーザーからの質問に丁寧に答え、スケジュール管理やタスク管理をサポートします。
以下のガイドラインに従ってください：

1. 親しみやすく丁寧な口調で会話してください
2. 専門用語は避け、わかりやすい表現を心がけてください
3. 確信がないことについては、わからないと正直に伝えてください
4. イベント情報や顧客情報については正確さを最優先してください
5. 曖昧な質問には、詳細を尋ねて明確にしてから回答してください`;

  private ragTemplate = `以下は{user_name}さんからの質問と、関連する情報です。

質問：{query}

関連情報：
{context}

上記の関連情報を参考にして、質問に答えてください。
情報が不十分な場合は、その旨を伝え、どのような情報が必要かを示してください。
情報の出典も含めて回答してください。`;

  /**
   * システムプロンプトを設定
   * @param systemPrompt 新しいシステムプロンプト
   */
  setSystemPrompt(systemPrompt: string): void {
    this.defaultSystemPrompt = systemPrompt;
  }

  /**
   * 基本的なプロンプトを構築
   * @param query ユーザークエリ
   * @param userName ユーザー名
   * @returns システムプロンプトとユーザープロンプトの配列
   */
  buildBasicPrompt(query: string, userName: string = 'ユーザー'): string[] {
    return [
      this.defaultSystemPrompt,
      query
    ];
  }

  /**
   * RAG検索結果を含むプロンプトを構築
   * @param query ユーザークエリ
   * @param searchResults 検索結果
   * @param userName ユーザー名
   * @returns システムプロンプトとユーザープロンプトの配列
   */
  async buildRAGPrompt(query: string, searchResults: SearchResult[], userName: string = 'ユーザー'): Promise<string[]> {
    // 検索結果をプロンプト用のコンテキストに整形
    const context = retriever.formatContextForPrompt(searchResults);
    
    // RAGテンプレートを適用
    const ragPrompt = this.ragTemplate
      .replace('{user_name}', userName)
      .replace('{query}', query)
      .replace('{context}', context);
    
    return [
      this.defaultSystemPrompt,
      ragPrompt
    ];
  }

  /**
   * 検索を実行してプロンプトを構築
   * @param query ユーザークエリ
   * @param filters 検索フィルター
   * @param userName ユーザー名
   * @returns システムプロンプトとユーザープロンプトの配列
   */
  async searchAndBuildPrompt(query: string, filters?: Record<string, any>, userName: string = 'ユーザー'): Promise<string[]> {
    console.log(`🔍 promptBuilder.searchAndBuildPrompt() 発動: "${query.substring(0, 30)}..."`);
    try {
      // 検索を実行
      const searchResults = await retriever.search(query, filters);
      console.log(`検索結果取得成功: ${searchResults.length}件`);
      
      // 検索結果を使用してRAGプロンプトを構築
      const ragPrompt = await this.buildRAGPrompt(query, searchResults, userName);
      console.log('RAGプロンプト構築完了');
      
      return ragPrompt;
    } catch (error) {
      console.error('プロンプト構築エラー:', error);
      
      // エラー時は基本プロンプトを返す
      return [
        this.defaultSystemPrompt,
        `質問：${query}\n\n残念ながら、検索中にエラーが発生したため、関連情報を取得できませんでした。一般的な知識に基づいて回答します。`
      ];
    }
  }

  /**
   * RAGプロンプト用のテンプレートをカスタマイズ
   * @param template 新しいRAGテンプレート
   */
  setRAGTemplate(template: string): void {
    this.ragTemplate = template;
  }
}

export default new PromptBuilder();
