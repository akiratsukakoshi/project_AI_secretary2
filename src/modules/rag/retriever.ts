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
      console.log(`\n📣📣📣 Retriever.search() が呼び出されました 📣📣📣`);
      console.log(`クエリ: "${query}"`);
      console.log('フィルター:', JSON.stringify(filters));
      console.log('取得上限:', limit || '未指定（デフォルト値使用）');
      
      const searchQuery: SearchQuery = {
        query,
        filters,
        limit
      };
      
      console.log('🔄 ragService.search() を呼び出します...');
      console.log('searchQuery:', JSON.stringify(searchQuery));
      
      // デバッグログ追加：ragService.search呼び出し直前
      console.log('\n🔍🔍🔍 ragService.search() 呼び出し直前 🔍🔍🔍');
      console.time('ragService.search実行時間');

      // 呼び出し元情報を取得するためのスタックトレース
      const stackTrace = new Error().stack;
      console.log('呼び出し元スタック:', stackTrace);
      
      try {
        const results = await ragService.search(searchQuery);
        
        // デバッグログ追加：ragService.search呼び出し直後
        console.timeEnd('ragService.search実行時間');
        console.log(`\n✅ ragService.search() が完了しました`);
        console.log(`検索結果: ${results.length}件`);
        
        // 検索結果サンプル
        if (results.length > 0) {
          console.log('検索結果のサンプル:');
          console.log(JSON.stringify(results[0]).substring(0, 200) + '...');
        } else {
          console.log('検索結果は0件でした');
        }
        
        return results;
      } catch (error) {
        // デバッグログ追加：ragService.search呼び出しエラー
        console.error('\n❌❌❌ ragService.search()でエラー発生');
        console.error('エラータイプ:', typeof error);
        console.error('エラーメッセージ:', error instanceof Error ? error.message : 'メッセージなし');
        console.error('エラースタック:', error instanceof Error ? error.stack : 'スタックなし');
        throw error; // 上位へエラーを再スロー
      }
    } catch (error) {
      console.error('❌❌❌ 検索エラー:', error);
      console.error('エラータイプ:', typeof error);
      console.error('エラーメッセージ:', error instanceof Error ? error.message : 'メッセージなし');
      console.error('エラースタック:', error instanceof Error ? error.stack : 'スタックなし');
      throw new Error('ベクトル検索中にエラーが発生しました: ' + (error instanceof Error ? error.message : String(error)));
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
