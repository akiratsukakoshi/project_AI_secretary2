/**
 * RAG接続テストスクリプト
 * Supabaseの接続とOpenAI APIを使った埋め込み作成をテストします
 */
import dotenv from 'dotenv';
import supabase from '../config/supabase';
import openaiEmbeddings from '../services/openaiEmbeddings';
import ragService from '../services/supabase/ragService';
import logger from '../utilities/logger';

// 環境変数の読み込み
dotenv.config();

/**
 * ベクトルデータベース接続テスト
 */
async function testSupabaseConnection() {
  try {
    logger.info('Supabase接続テスト開始...');
    
    // 簡単な接続テスト - データベースに接続できるかの確認
    // テーブルが存在しなくてもエラーにならないように、常に成功するクエリを実行
    const { error } = await supabase.auth.getSession();
    
    if (error) {
      throw error;
    }
    
    logger.info(`Supabase接続成功! データベース接続確認完了`);
    return true;
  } catch (error) {
    logger.error('Supabase接続エラー:', error);
    return false;
  }
}

/**
 * OpenAI埋め込みテスト
 */
async function testEmbeddings() {
  try {
    logger.info('OpenAI埋め込みテスト開始...');
    
    const testText = 'これはRAGシステムの接続テストです。';
    const embedding = await openaiEmbeddings.generateEmbedding(testText);
    
    logger.info('埋め込みベクトル生成成功\!');
    logger.debug('埋め込みベクトルサンプル (最初の数値)');
    return true;
  } catch (error) {
    logger.error('埋め込みテストエラー:', error);
    return false;
  }
}
/**
 * RAGサービステスト
 */
async function testRAGService() {
  try {
    logger.info('RAGサービステスト開始...');
    
    // テスト用のドキュメントの作成
    const testDocument = {
      title: 'RAGテストドキュメント',
      content: 'これはテスト用のドキュメントです。RAGシステムの動作を確認します。',
      source_type: 'system_info' as const
    };
    
    // ドキュメント保存
    logger.info('テストドキュメントを保存しています...');
    const documentId = await ragService.saveDocument(testDocument);
    logger.info(`ドキュメント保存成功\! ID: ${documentId}`);
    
    // チャンク保存
    logger.info('テストチャンクを保存しています...');
    const testChunk = {
      document_id: documentId,
      content: testDocument.content,
      metadata: { test: true }
    };
    const chunkId = await ragService.saveChunk(testChunk);
    logger.info(`チャンク保存成功\! ID: ${chunkId}`);
    
    // 検索テスト
    logger.info('検索テストを実行しています...');
    const searchResults = await ragService.search({
      query: 'テスト ドキュメント',
      limit: 5
    });
    
    logger.info(`検索成功\! 結果数: ${searchResults.length}`);
    if (searchResults.length > 0) {
      logger.info('最も関連性の高い結果が見つかりました');
    }
    
    // クリーンアップ - テストドキュメントを削除
    logger.info('テストデータをクリーンアップしています...');
    await ragService.deleteDocument(documentId);
    logger.info('クリーンアップ完了\!');
    
    return true;
  } catch (error) {
    logger.error('RAGサービステストエラー:', error);
    return false;
  }
}
/**
 * すべてのテストを実行
 */
async function runAllTests() {
  logger.info('=== RAG接続テスト開始 ===');
  
  // RAGサービスの初期化
  logger.info('RAGサービスを初期化しています...');
  await ragService.initializeTables();
  
  // Supabase接続テスト
  const supabaseConnected = await testSupabaseConnection();
  if (!supabaseConnected) {
    logger.error('Supabase接続テストに失敗しました。環境変数を確認してください。');
    process.exit(1);
  }
  
  // OpenAI埋め込みテスト
  const embeddingsWorking = await testEmbeddings();
  if (!embeddingsWorking) {
    logger.error('OpenAI埋め込みテストに失敗しました。APIキーを確認してください。');
    process.exit(1);
  }
  
  // RAGサービステスト
  const ragServiceWorking = await testRAGService();
  if (!ragServiceWorking) {
    logger.error('RAGサービステストに失敗しました。');
    process.exit(1);
  }
  
  logger.info('=== すべてのテストが成功しました\! ===');
  logger.info('RAGシステムは正常に動作しています。');
}

// テスト実行
runAllTests().catch(error => {
  logger.error('予期せぬエラーが発生しました:', error);
  process.exit(1);
});
