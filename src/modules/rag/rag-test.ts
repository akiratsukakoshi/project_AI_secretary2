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
      
      // 検索テスト
      result += "### 検索テスト\n";
      const searchResults = await ragService.search({
        query: 'テスト ドキュメント',
        limit: 5
      });
      
      result += "✅ 成功: 検索実行 (結果数: " + searchResults.length + ")\n";
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
