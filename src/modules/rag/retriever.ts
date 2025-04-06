import ragService from '../../services/supabase/ragService';
import { SearchQuery, SearchResult } from '../../interfaces/rag';

/**
 * RAGシステムからドキュメントを検索するクラス
 */
class Retriever {
  /**
   * テキストクエリに基づいてベクトル検索を実行
   * @param query 検索クエリテキスト
   * @param filters 検索フィルター（メタデータに基づく）
   * @param limit 取得する結果数
   * @returns 検索結果の配列
   */
  async search(query: string, filters?: Record<string, any>, limit?: number): Promise<SearchResult[]> {
    try {
      const searchQuery: SearchQuery = {
        query,
        filters,
        limit
      };
      
      return await ragService.search(searchQuery);
    } catch (error) {
      console.error('検索エラー:', error);
      throw new Error('ベクトル検索中にエラーが発生しました');
    }
  }

  /**
   * 検索結果からプロンプト用のコンテキストを生成
   * @param results 検索結果の配列
   * @returns プロンプトで使用するコンテキスト文字列
   */
  formatContextForPrompt(results: SearchResult[]): string {
    if (results.length === 0) {
      return '関連情報は見つかりませんでした。';
    }

    const formattedResults = results.map((result, index) => {
      const sourceType = this.formatSourceType(result.source_type);
      
      return `情報${index + 1}（${sourceType}）:\n${result.content}\n`;
    });

    return formattedResults.join('\n');
  }

  /**
   * ソースタイプを日本語に変換
   * @param sourceType ソースタイプ
   * @returns 日本語のソースタイプ文字列
   */
  private formatSourceType(sourceType?: string): string {
    if (!sourceType) return '情報';
    
    switch (sourceType) {
      case 'faq':
        return 'FAQ';
      case 'event':
        return 'イベント情報';
      case 'customer':
        return '顧客情報';
      case 'meeting_note':
        return '会議メモ';
      case 'system_info':
        return 'システム情報';
      default:
        return sourceType;
    }
  }

  /**
   * 検索結果をフィルタリングして重複や低品質な結果を除去
   * @param results 元の検索結果
   * @param similarityThreshold 類似度の閾値
   * @returns フィルタリングされた検索結果
   */
  filterSearchResults(results: SearchResult[], similarityThreshold = 0.6): SearchResult[] {
    // 類似度閾値でフィルタリング
    const filteredBySimilarity = results.filter(
      result => result.similarity !== undefined && result.similarity >= similarityThreshold
    );
    
    // 重複コンテンツを除去（内容が90%以上一致するものは重複と見なす）
    const uniqueResults: SearchResult[] = [];
    const seenContents = new Set<string>();
    
    for (const result of filteredBySimilarity) {
      // 既存の結果と重複していないかチェック
      let isDuplicate = false;
      const normalizedContent = result.content.toLowerCase().trim();
      
      for (const seenContent of seenContents) {
        const similarity = this.calculateTextSimilarity(normalizedContent, seenContent);
        if (similarity > 0.9) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueResults.push(result);
        seenContents.add(normalizedContent);
      }
    }
    
    return uniqueResults;
  }
  
  /**
   * 単純なテキスト類似性を計算
   * @param text1 比較するテキスト1
   * @param text2 比較するテキスト2
   * @returns 0～1の類似度
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // 短い方のテキストを基準にする
    const [shorter, longer] = text1.length <= text2.length
      ? [text1, text2]
      : [text2, text1];
      
    // 共通の部分文字列を近似的に計算
    let commonChars = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] === longer[i]) {
        commonChars++;
      }
    }
    
    // 類似度を計算（共通文字数 / 長い方の文字数）
    return commonChars / longer.length;
  }
}

export default new Retriever();
