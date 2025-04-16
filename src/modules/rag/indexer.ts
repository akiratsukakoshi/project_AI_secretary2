import { Document } from '../../interfaces/rag';
import supabase from '../../config/supabase';
import chunker from './chunker';
import { v4 as uuidv4 } from 'uuid';
import ragService from '../../services/supabase/ragService';

/**
 * ドキュメントインデクサーモジュール
 * 
 * ドキュメントのインデックス化とチャンク管理を行う
 */
class Indexer {
  /**
   * ドキュメントをインデックス化する
   * @param document インデックス化するドキュメント
   * @returns インデックス化されたドキュメントのID
   */
  async indexDocument(document: Document): Promise<string> {
    try {
      // document.idがない場合はUUIDを生成
      const docId = document.id || uuidv4();
      
      // ドキュメント情報をSupabaseに保存
      // debug: コンソールに出力
      console.debug('インデックス化するドキュメント:', {
        id: docId,
        title: document.title,
        content: document.content.substring(0, 100) + '...',
        source_type: document.source_type,
        metadata: document.metadata
      });
      
      const { data, error } = await supabase
        .from('documents')
        .insert({
          id: docId,
          title: document.title,
          content: document.content,
          source_type: document.source_type,
          source_id: document.source_id,
          metadata: document.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('ドキュメント保存エラー:', error);
        throw error;
      }
      
      return docId;
    } catch (error) {
      console.error('ドキュメントのインデックス化エラー:', error);
      throw new Error('ドキュメントのインデックス化に失敗しました');
    }
  }
  
  /**
   * ドキュメントをチャンク分割してインデックス化する
   * @param document インデックス化するドキュメント
   * @returns チャンク数
   */
  async indexDocumentWithChunks(document: Document): Promise<number> {
    try {
      // ドキュメントを保存
      const docId = await this.indexDocument(document);
      
      // ドキュメントをチャンク分割
      const chunks = chunker.chunkDocument(document);
      
      // 各チャンクにドキュメントIDを設定
      const chunksWithDocId = chunks.map(chunk => ({
        ...chunk,
        document_id: docId
      }));
      
      // チャンクを保存
      await ragService.saveChunks(chunksWithDocId);
      
      return chunks.length;
    } catch (error) {
      console.error('ドキュメントとチャンクのインデックス化エラー:', error);
      throw new Error('ドキュメントとチャンクのインデックス化に失敗しました');
    }
  }
  
  /**
   * チャンクをインデックス化する
   * @param documentId チャンクが属するドキュメントID
   * @param chunk インデックス化するチャンク
   * @returns インデックス化されたチャンクのID
   */
  async indexChunk(documentId: string, chunk: any): Promise<string> {
    try {
      // チャンクIDを設定
      const chunkId = chunk.id || uuidv4();
      
      // ドキュメントIDを設定
      chunk.document_id = documentId;
      
      // チャンク情報をSupabaseに保存
      const { data, error } = await supabase
        .from('chunks')
        .insert({
          id: chunkId,
          document_id: documentId,
          content: chunk.content,
          metadata: chunk.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('チャンク保存エラー:', error);
        throw error;
      }
      
      return chunkId;
    } catch (error) {
      console.error('チャンクのインデックス化エラー:', error);
      throw new Error('チャンクのインデックス化に失敗しました');
    }
  }
}

// シングルトンインスタンスをエクスポート
export default new Indexer();
