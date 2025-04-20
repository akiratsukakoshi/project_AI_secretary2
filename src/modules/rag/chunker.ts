import { Document, Chunk, ChunkingOptions } from '../../interfaces/rag';

/**
 * ドキュメントチャンキングモジュール
 * 様々なタイプのドキュメントを適切な方法でチャンク分割する
 */
class Chunker {
  /**
   * ドキュメントをチャンク分割する（拡張版）
   */
  chunkDocument(document: Document, options?: ChunkingOptions): Chunk[] {
    if (!document.content) {
      console.warn('チャンキング対象のコンテンツが空です');
      return [];
    }
    
    // チャンク分割を実行
    let chunks: Chunk[];
    
    // ドキュメントタイプに基づいて最適な方法を選択
    switch (document.source_type) {
      case 'faq':
        chunks = this.chunkFAQ(document, options);
        break;
      case 'event':
        chunks = this.chunkEvent(document, options);
        break;
      case 'customer':
        chunks = this.chunkCustomer(document, options);
        break;
      case 'meeting_note':
        chunks = this.chunkMeetingNote(document, options);
        break;
      case 'system_info':
        chunks = this.chunkSystemInfo(document, options);
        break;
      default:
        chunks = this.defaultChunking(document, options);
    }
    
    // 各チャンクのメタデータを拡張
    return chunks.map((chunk, index) => {
      // 既存のメタデータがない場合は初期化
      if (!chunk.metadata) {
        chunk.metadata = {};
      }
      
      // チャンク番号
      chunk.metadata.chunk_index = index;
      chunk.metadata.total_chunks = chunks.length;
      
      // チャンクのタイトルがない場合は生成
      if (!chunk.metadata.title) {
        // 見出しの検出
        const headingMatch = chunk.content.match(/^(#{1,3})\s+(.+)$/m);
        if (headingMatch) {
          chunk.metadata.title = headingMatch[2].trim();
          chunk.metadata.heading_level = headingMatch[1].length;
        } else {
          // デフォルトタイトル
          chunk.metadata.title = `${document.title} (セクション${index + 1})`;
        }
      }
      
      // チャンクの要約がない場合は生成
      if (!chunk.metadata.summary) {
        chunk.metadata.summary = this.generateChunkSummary(chunk.content);
      }
      
      // 親ドキュメントのタイトルを追加
      if (document.title) {
        chunk.metadata.document_title = document.title;
      }
      
      // source_typeを必ず含める
      chunk.metadata.source_type = document.source_type;
      
      // メタデータからfile_pathを削除（セキュリティ向上）
      if (chunk.metadata.file_path) {
        delete chunk.metadata.file_path;
      }
      
      // ドキュメントのメタデータからタグを継承
      if (document.metadata && Array.isArray(document.metadata.tags)) {
        chunk.metadata.tags = document.metadata.tags;
      }
      
      return chunk;
    });
  }
  
  /**
   * チャンクの要約を生成
   */
  private generateChunkSummary(content: string, maxLength: number = 150): string {
    // 改行を空白に置換、複数の空白を一つの空白に
    const normalizedContent = content.replace(/\s+/g, ' ').trim();
    
    // 最初のN文字を抽出
    if (normalizedContent.length <= maxLength) {
      return normalizedContent;
    }
    
    // 文単位で区切って先頭から結合
    const sentences = normalizedContent.match(/[^.!?]+[.!?]+/g) || [];
    let summary = '';
    
    for (const sentence of sentences) {
      if (summary.length + sentence.length <= maxLength) {
        summary += sentence;
      } else {
        break;
      }
    }
    
    // 文単位で区切れない場合は単純に切る
    if (!summary) {
      summary = normalizedContent.substring(0, maxLength) + '...';
    }
    
    return summary;
  }
  
  /**
   * デフォルトのチャンク分割
   */
  private defaultChunking(document: Document, options?: ChunkingOptions): Chunk[] {
    const content = document.content;
    const chunkSize = options?.chunkSize || 300;
    
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
   * FAQ形式のドキュメントをチャンク分割（拡張版）
   */
  private chunkFAQ(document: Document, options?: ChunkingOptions): Chunk[] {
    // 見出しを使用した基本的な分割
    const content = document.content;
    const sections = content.split(/(?=#{1,3}\s+)/);
    
    return sections.map(section => {
      // 見出しからタイトルを抽出
      const headingMatch = section.match(/^#{1,3}\s+(.+)$/m);
      const title = headingMatch ? headingMatch[1].trim() : `${document.title}のセクション`;
      
      // 要約を生成
      const summary = this.generateChunkSummary(section);
      
      return {
        document_id: document.id || '',
        content: section,
        metadata: { 
          ...document.metadata,
          type: 'faq',
          has_heading: section.startsWith('#'),
          title: title,
          summary: summary,
          source_type: document.source_type
        }
      };
    });
  }
  
  /**
   * イベント情報のチャンク分割（拡張版）
   */
  private chunkEvent(document: Document, options?: ChunkingOptions): Chunk[] {
    // 要約を生成
    const summary = this.generateChunkSummary(document.content);
    
    // イベントはそのまま1チャンクとして扱う
    return [{
      document_id: document.id || '',
      content: document.content,
      metadata: { 
        ...document.metadata,
        type: 'event',
        title: document.title,
        summary: summary,
        source_type: document.source_type
      }
    }];
  }
  
  /**
   * 顧客情報のチャンク分割（拡張版）
   */
  private chunkCustomer(document: Document, options?: ChunkingOptions): Chunk[] {
    // 要約を生成
    const summary = this.generateChunkSummary(document.content);
    
    // 顧客情報もそのまま1チャンクとして扱う
    return [{
      document_id: document.id || '',
      content: document.content,
      metadata: { 
        ...document.metadata,
        type: 'customer',
        title: document.title,
        summary: summary,
        source_type: document.source_type
      }
    }];
  }
  
  /**
   * 議事録のチャンク分割（拡張版）
   */
  private chunkMeetingNote(document: Document, options?: ChunkingOptions): Chunk[] {
    // 見出しを使用した基本的な分割
    const content = document.content;
    const sections = content.split(/(?=#{1,3}\s+)/);
    
    return sections.map(section => {
      // 見出しからタイトルを抽出
      const headingMatch = section.match(/^#{1,3}\s+(.+)$/m);
      const title = headingMatch ? headingMatch[1].trim() : `${document.title}のセクション`;
      
      // 要約を生成
      const summary = this.generateChunkSummary(section);
      
      return {
        document_id: document.id || '',
        content: section,
        metadata: { 
          ...document.metadata,
          type: 'meeting_note',
          has_heading: section.startsWith('#'),
          title: title,
          summary: summary,
          source_type: document.source_type
        }
      };
    });
  }
  
  /**
   * システム情報のチャンク分割（拡張版）
   */
  private chunkSystemInfo(document: Document, options?: ChunkingOptions): Chunk[] {
    // 見出しを使用した基本的な分割
    const content = document.content;
    const sections = content.split(/(?=#{1,3}\s+)/);
    
    return sections.map(section => {
      // 見出しからタイトルを抽出
      const headingMatch = section.match(/^#{1,3}\s+(.+)$/m);
      const title = headingMatch ? headingMatch[1].trim() : `${document.title}のセクション`;
      
      // 要約を生成
      const summary = this.generateChunkSummary(section);
      
      return {
        document_id: document.id || '',
        content: section,
        metadata: { 
          ...document.metadata,
          type: 'system_info',
          has_heading: section.startsWith('#'),
          title: title,
          summary: summary,
          source_type: document.source_type
        }
      };
    });
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
