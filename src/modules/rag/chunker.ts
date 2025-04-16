import { Document, Chunk, ChunkingOptions } from '../../interfaces/rag';

/**
 * ドキュメントチャンキングモジュール
 * 様々なタイプのドキュメントを適切な方法でチャンク分割する
 */
class Chunker {
  /**
   * ドキュメントをチャンク分割する
   */
  chunkDocument(document: Document, options?: ChunkingOptions): Chunk[] {
    if (!document.content) {
      console.warn('チャンキング対象のコンテンツが空です');
      return [];
    }
    
    // ドキュメントタイプに基づいて最適な方法を選択
    switch (document.source_type) {
      case 'faq':
        return this.chunkFAQ(document, options);
      case 'event':
        return this.chunkEvent(document, options);
      case 'customer':
        return this.chunkCustomer(document, options);
      case 'meeting_note':
        return this.chunkMeetingNote(document, options);
      case 'system_info':
        return this.chunkSystemInfo(document, options);
      default:
        return this.defaultChunking(document, options);
    }
  }
  
  /**
   * デフォルトのチャンク分割
   */
  private defaultChunking(document: Document, options?: ChunkingOptions): Chunk[] {
    const content = document.content;
    const chunkSize = options?.chunkSize || 1000;
    
    // 段落で分割する基本的な処理
    const paragraphs = content.split(/\n\n+/);
    const chunks: Chunk[] = [];
    let currentChunk = '';
    
    for (const para of paragraphs) {
      // チャンクサイズを超えそうなら新しいチャンクを開始
      if (currentChunk.length + para.length + 2 > chunkSize) {
        chunks.push({
          document_id: document.id || '',
          content: currentChunk,
          metadata: { ...document.metadata }
        });
        currentChunk = para;
      } else {
        // 現在のチャンクに段落を追加
        currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
      }
    }
    
    // 最後のチャンクを追加
    if (currentChunk) {
      chunks.push({
        document_id: document.id || '',
        content: currentChunk,
        metadata: { ...document.metadata }
      });
    }
    
    return chunks;
  }
  
  /**
   * FAQ形式のドキュメントをチャンク分割
   */
  private chunkFAQ(document: Document, options?: ChunkingOptions): Chunk[] {
    // 見出しを使用した基本的な分割
    const content = document.content;
    const sections = content.split(/(?=#{1,3}\s+)/);
    
    return sections.map(section => ({
      document_id: document.id || '',
      content: section,
      metadata: { 
        ...document.metadata,
        type: 'faq',
        has_heading: section.startsWith('#')
      }
    }));
  }
  
  /**
   * イベント情報のチャンク分割
   */
  private chunkEvent(document: Document, options?: ChunkingOptions): Chunk[] {
    // イベントはそのまま1チャンクとして扱う
    return [{
      document_id: document.id || '',
      content: document.content,
      metadata: { 
        ...document.metadata,
        type: 'event'
      }
    }];
  }
  
  /**
   * 顧客情報のチャンク分割
   */
  private chunkCustomer(document: Document, options?: ChunkingOptions): Chunk[] {
    // 顧客情報もそのまま1チャンクとして扱う
    return [{
      document_id: document.id || '',
      content: document.content,
      metadata: { 
        ...document.metadata,
        type: 'customer'
      }
    }];
  }
  
  /**
   * 議事録のチャンク分割
   */
  private chunkMeetingNote(document: Document, options?: ChunkingOptions): Chunk[] {
    // 見出しを使用した基本的な分割
    const content = document.content;
    const sections = content.split(/(?=#{1,3}\s+)/);
    
    return sections.map(section => ({
      document_id: document.id || '',
      content: section,
      metadata: { 
        ...document.metadata,
        type: 'meeting_note',
        has_heading: section.startsWith('#')
      }
    }));
  }
  
  /**
   * システム情報のチャンク分割
   */
  private chunkSystemInfo(document: Document, options?: ChunkingOptions): Chunk[] {
    // 見出しを使用した基本的な分割
    const content = document.content;
    const sections = content.split(/(?=#{1,3}\s+)/);
    
    return sections.map(section => ({
      document_id: document.id || '',
      content: section,
      metadata: { 
        ...document.metadata,
        type: 'system_info',
        has_heading: section.startsWith('#')
      }
    }));
  }
  
  /**
   * Q&Aパターンでチャンク分割（シンプル実装）
   */
  private chunkByQA(document: Document, options?: ChunkingOptions): Chunk[] {
    const content = document.content;
    // Q&Aパターンで分割
    const qaPairs = content.split(/(?=Q[:：])/i).filter(Boolean);
    
    return qaPairs.map(qaPair => ({
      document_id: document.id || '',
      content: qaPair,
      metadata: { 
        ...document.metadata,
        type: 'faq',
        is_qa_pair: true
      }
    }));
  }
  
  /**
   * 見出しでチャンク分割（シンプル実装）
   */
  private chunkByHeadings(document: Document, options?: ChunkingOptions): Chunk[] {
    const content = document.content;
    const sections = content.split(/(?=#{1,3}\s+)/);
    
    return sections.map(section => ({
      document_id: document.id || '',
      content: section,
      metadata: { 
        ...document.metadata,
        has_heading: section.startsWith('#')
      }
    }));
  }
}

// シングルトンインスタンスをエクスポート
export default new Chunker();
