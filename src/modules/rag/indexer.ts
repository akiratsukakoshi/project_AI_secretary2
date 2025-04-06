import chunker from './chunker';
import ragService from '../../services/supabase/ragService';
import { Document, Chunk, ChunkingOptions } from '../../interfaces/rag';

/**
 * ドキュメントをインデックス化するクラス
 */
class Indexer {
  /**
   * ドキュメントをインデックス化
   * @param document インデックス化するドキュメント
   * @param options チャンキングオプション
   * @returns 保存されたドキュメントID
   */
  async indexDocument(document: Document, options?: ChunkingOptions): Promise<string> {
    try {
      // 1. ドキュメントをSupabaseに保存
      const documentId = await ragService.saveDocument(document);
      
      // 一時IDが指定されていた場合は実際のIDに更新
      if (document.id === 'temp-id') {
        document.id = documentId;
      }
      
      // 2. ドキュメントをチャンクに分割
      const chunks = chunker.chunkDocument(document, options);
      
      // 3. チャンクを保存
      await ragService.saveChunks(chunks);
      
      return documentId;
    } catch (error) {
      console.error('ドキュメントインデックス化エラー:', error);
      throw new Error('ドキュメントのインデックス化中にエラーが発生しました');
    }
  }

  /**
   * 複数のドキュメントをバッチでインデックス化
   * @param documents インデックス化するドキュメントの配列
   * @param options チャンキングオプション
   * @returns 保存されたドキュメントIDの配列
   */
  async indexDocuments(documents: Document[], options?: ChunkingOptions): Promise<string[]> {
    try {
      const documentIds: string[] = [];
      
      // ドキュメントごとに処理
      for (const document of documents) {
        const documentId = await this.indexDocument(document, options);
        documentIds.push(documentId);
      }
      
      return documentIds;
    } catch (error) {
      console.error('バッチインデックス化エラー:', error);
      throw new Error('複数ドキュメントのインデックス化中にエラーが発生しました');
    }
  }
  
  /**
   * ドキュメントを更新してインデックスを再構築
   * @param documentId 更新するドキュメントのID
   * @param updates 更新内容
   * @param options チャンキングオプション
   * @returns 更新が成功したかどうか
   */
  async updateAndReindexDocument(documentId: string, updates: Partial<Document>, options?: ChunkingOptions): Promise<boolean> {
    try {
      // 1. 既存のドキュメントを取得
      const existingDocument = await ragService.getDocumentById(documentId);
      
      if (\!existingDocument) {
        throw new Error('更新対象のドキュメントが見つかりません');
      }
      
      // 2. 更新内容をマージ
      const updatedDocument: Document = {
        ...existingDocument,
        ...updates,
        id: documentId
      };
      
      // 3. コンテンツが変更された場合は再チャンク化
      if (updates.content) {
        // 既存のチャンクを削除
        await ragService.deleteDocument(documentId);
        
        // ドキュメントを再作成
        await ragService.saveDocument(updatedDocument);
        
        // 新しいチャンクを作成して保存
        const newChunks = chunker.chunkDocument(updatedDocument, options);
        await ragService.saveChunks(newChunks);
      } else {
        // コンテンツが変更されていない場合はドキュメントのみ更新
        await ragService.updateDocument(documentId, updates);
      }
      
      return true;
    } catch (error) {
      console.error('ドキュメント更新/再インデックス化エラー:', error);
      throw new Error('ドキュメントの更新と再インデックス化中にエラーが発生しました');
    }
  }
  
  /**
   * ドキュメントとそのチャンクを削除
   * @param documentId 削除するドキュメントのID
   * @returns 削除が成功したかどうか
   */
  async deleteIndexedDocument(documentId: string): Promise<boolean> {
    try {
      return await ragService.deleteDocument(documentId);
    } catch (error) {
      console.error('インデックスドキュメント削除エラー:', error);
      throw new Error('インデックス済みドキュメントの削除中にエラーが発生しました');
    }
  }
}

export default new Indexer();
