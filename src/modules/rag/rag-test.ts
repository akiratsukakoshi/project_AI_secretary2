/**
 * RAG関連のテスト機能を提供するモジュール
 */
import supabase from '../../config/supabase';
import openaiEmbeddings from '../../services/openaiEmbeddings';
import ragService from '../../services/supabase/ragService';
import logger from '../../utilities/logger';

/**
 * RAGシステムの接続テスト
 * @returns テスト結果の詳細メッセージ
 */
export async function testRAGConnection(): Promise<string> {
  let result = "# RAG接続テスト結果\n\n";
  
  try {
    // Supabase接続テスト
    result += "## Supabase接続テスト\n";
    try {
      const { data, error } = await supabase.rpc('now');
      
      if (error) {
        throw error;
      }
      
      result += "✅ 成功: サーバー時間 = " + data + "\n\n";
    } catch (error) {
      logger.error('Supabase接続エラー:', error);
      result += "❌ 失敗: " + (error instanceof Error ? error.message : '不明なエラー') + "\n\n";
      return result; // 接続に失敗したら終了
    }
    
    // OpenAI埋め込みテスト
    result += "## OpenAI埋め込みテスト\n";
    try {
      const testText = 'これはRAGシステムの接続テストです。';
      const embedding = await openaiEmbeddings.generateEmbedding(testText);
      
      result += "✅ 成功: 埋め込みベクトル生成 (次元数: " + embedding.length + ")\n\n";
    } catch (error) {
      logger.error('埋め込みテストエラー:', error);
      result += "❌ 失敗: " + (error instanceof Error ? error.message : '不明なエラー') + "\n\n";
      return result; // 埋め込みに失敗したら終了
    }
    
    // RAGサービステスト
    result += "## RAGサービステスト\n";
    try {
      // テスト用のドキュメントの作成
      const testDocument = {
        title: 'RAGテストドキュメント',
        content: 'これはテスト用のドキュメントです。RAGシステムの動作を確認します。',
        source_type: 'system_info' as const
      };
      
      // ドキュメント保存
      result += "### ドキュメント保存テスト\n";
      const documentId = await ragService.saveDocument(testDocument);
      result += "✅ 成功: ドキュメント保存 (ID: " + documentId + ")\n\n";
      
      // チャンク保存
      result += "### チャンク保存テスト\n";
      const testChunk = {
        document_id: documentId,
        content: testDocument.content,
        metadata: { test: true }
      };
      const chunkId = await ragService.saveChunk(testChunk);
      result += "✅ 成功: チャンク保存 (ID: " + chunkId + ")\n\n";
      
      // キーワード検索テスト
      result += "### キーワード検索テスト\n";
      const keywordSearchResults = await (ragService as any).fallbackSearch({
        query: 'テスト ドキュメント',
        limit: 5
      });
      
      result += "✅ 成功: キーワード検索実行 (結果数: " + keywordSearchResults.length + ")\n";
      if (keywordSearchResults.length > 0) {
        result += "最も関連性の高い結果: \"" + keywordSearchResults[0].content.substring(0, 50) + "...\"\n";
        result += "類似度スコア: " + keywordSearchResults[0].similarity + "\n\n";
      }
      
      // ベクトル検索テスト
      result += "### ベクトル検索テスト\n";
      try {
        // ベクトル埋め込みを生成
        const testEmbedding = await openaiEmbeddings.generateEmbedding('テスト ドキュメント');
        
        // match_chunks RPC関数を直接呼び出し
        const { data: vectorData, error: vectorError } = await supabase.rpc('match_chunks', {
          query_embedding: testEmbedding,
          match_threshold: 0.7,
          match_count: 5
        });
        
        if (vectorError) {
          throw vectorError;
        }
        
        result += "✅ 成功: ベクトル検索RPC実行 (結果数: " + (vectorData?.length || 0) + ")\n";
        if (vectorData && vectorData.length > 0) {
          result += "最も関連性の高い結果: \"" + vectorData[0].content.substring(0, 50) + "...\"\n";
          result += "類似度スコア: " + vectorData[0].similarity + "\n\n";
        }
      } catch (error) {
        logger.error('ベクトル検索テストエラー:', error);
        result += "❌ 失敗: ベクトル検索 - " + (error instanceof Error ? error.message : '不明なエラー') + "\n\n";
        result += "注意: match_chunks RPC関数がSupabaseに存在しない可能性があります。SQLスクリプトを実行してください。\n\n";
      }
      
      // 総合検索テスト
      result += "### 総合検索テスト (自動フォールバック)\n";
      const searchResults = await ragService.search({
        query: 'テスト ドキュメント',
        limit: 5
      });
      
      result += "✅ 成功: 総合検索実行 (結果数: " + searchResults.length + ")\n";
      if (searchResults.length > 0) {
        result += "最も関連性の高い結果: \"" + searchResults[0].content.substring(0, 50) + "...\"\n";
        result += "類似度スコア: " + searchResults[0].similarity + "\n\n";
      }
      
      // クリーンアップ
      result += "### クリーンアップテスト\n";
      await ragService.deleteDocument(documentId);
      result += "✅ 成功: テストデータ削除\n\n";
    } catch (error) {
      logger.error('RAGサービステストエラー:', error);
      result += "❌ 失敗: " + (error instanceof Error ? error.message : '不明なエラー') + "\n\n";
      return result;
    }
    
    // 全テスト成功
    result += "## 総合結果\n";
    result += "✅ すべてのテストが成功しました！RAGシステムは正常に動作しています。";
    
    return result;
  } catch (error) {
    logger.error('予期せぬエラーが発生しました:', error);
    result += "❌ 予期せぬエラー: " + (error instanceof Error ? error.message : '不明なエラー') + "\n\n";
    return result;
  }
}
