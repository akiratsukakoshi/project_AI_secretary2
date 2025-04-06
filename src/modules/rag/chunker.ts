import { Document, Chunk, ChunkingOptions } from '../../interfaces/rag';

/**
 * テキストをチャンクに分割するクラス
 */
class Chunker {
  /**
   * ドキュメントをチャンクに分割
   * @param document 分割するドキュメント
   * @param options チャンキングオプション
   * @returns チャンクの配列
   */
  chunkDocument(document: Document, options?: ChunkingOptions): Chunk[] {
    // ドキュメントの種類に基づいて適切なチャンキング手法を選択
    switch (document.source_type) {
      case 'faq':
        return this.chunkFAQ(document);
      case 'event':
        return this.chunkEvent(document);
      case 'customer':
        return this.chunkCustomer(document);
      case 'meeting_note':
        return this.chunkMeetingNote(document, options);
      case 'system_info':
        return this.chunkByParagraphs(document, options);
      default:
        // デフォルトはサイズベースのチャンキング
        return this.chunkBySize(document, options);
    }
  }

  /**
   * FAQをチャンク分割（Q&Aペア単位）
   * @param document FAQ文書
   * @returns チャンクの配列
   */
  private chunkFAQ(document: Document): Chunk[] {
    // FAQをQ&Aペアに分割
    // 一般的な形式は "Q: 質問\nA: 回答" を想定
    const faqPattern = /Q:\s*(.*?)\s*\n*A:\s*([\s\S]*?)(?=\n*Q:|$)/g;
    const chunks: Chunk[] = [];
    let match;

    // FAQの質問と回答のペアを抽出
    const documentId = document.id || 'temp-id';
    while ((match = faqPattern.exec(document.content)) \!== null) {
      const question = match[1].trim();
      const answer = match[2].trim();

      if (question && answer) {
        chunks.push({
          document_id: documentId,
          content: `Q: ${question}\nA: ${answer}`,
          metadata: {
            ...document.metadata,
            question: question,
            type: 'faq'
          }
        });
      }
    }

    // パターンにマッチしない場合はドキュメント全体を1つのチャンクとして扱う
    if (chunks.length === 0) {
      chunks.push({
        document_id: documentId,
        content: document.content,
        metadata: {
          ...document.metadata,
          type: 'faq'
        }
      });
    }

    return chunks;
  }

  /**
   * イベント情報をチャンク分割（1イベント1チャンク）
   * @param document イベント文書
   * @returns チャンクの配列
   */
  private chunkEvent(document: Document): Chunk[] {
    // イベント情報は1つのイベントを1つのチャンクとして扱う
    return [{
      document_id: document.id || 'temp-id',
      content: document.content,
      metadata: {
        ...document.metadata,
        type: 'event'
      }
    }];
  }

  /**
   * 顧客情報をチャンク分割（1顧客1チャンク）
   * @param document 顧客情報文書
   * @returns チャンクの配列
   */
  private chunkCustomer(document: Document): Chunk[] {
    // 顧客情報は1人の顧客を1つのチャンクとして扱う
    return [{
      document_id: document.id || 'temp-id',
      content: document.content,
      metadata: {
        ...document.metadata,
        type: 'customer'
      }
    }];
  }

  /**
   * 会議メモをチャンク分割（議題や段落単位）
   * @param document 会議メモ文書
   * @param options チャンキングオプション
   * @returns チャンクの配列
   */
  private chunkMeetingNote(document: Document, options?: ChunkingOptions): Chunk[] {
    // 会議メモを議題や段落単位で分割
    const headingPattern = options?.customSplitter || /\n#{1,3}\s+(.+?)\n/g;
    const chunks: Chunk[] = [];
    let lastIndex = 0;
    let match;
    
    const content = document.content;
    const documentId = document.id || 'temp-id';

    // 見出しを探して分割
    while ((match = headingPattern.exec(content)) \!== null) {
      const heading = match[1].trim();
      const startIndex = match.index;
      
      // 前のセクションをチャンク化
      if (startIndex > lastIndex) {
        const sectionContent = content.substring(lastIndex, startIndex).trim();
        if (sectionContent) {
          chunks.push({
            document_id: documentId,
            content: sectionContent,
            metadata: {
              ...document.metadata,
              type: 'meeting_note',
              sectionTitle: heading
            }
          });
        }
      }
      
      lastIndex = startIndex + match[0].length;
    }
    
    // 最後のセクションをチャンク化
    if (lastIndex < content.length) {
      const sectionContent = content.substring(lastIndex).trim();
      if (sectionContent) {
        chunks.push({
          document_id: documentId,
          content: sectionContent,
          metadata: {
            ...document.metadata,
            type: 'meeting_note'
          }
        });
      }
    }
    
    // 見出しが見つからない場合は段落で分割
    if (chunks.length === 0) {
      return this.chunkByParagraphs(document, options);
    }
    
    return chunks;
  }

  /**
   * テキストを段落単位でチャンク分割
   * @param document 文書
   * @param options チャンキングオプション
   * @returns チャンクの配列
   */
  private chunkByParagraphs(document: Document, options?: ChunkingOptions): Chunk[] {
    const content = document.content;
    const documentId = document.id || 'temp-id';
    const chunks: Chunk[] = [];
    
    // 段落で分割（空行を区切りとする）
    const paragraphs = content.split(/\n\s*\n/);
    
    let currentChunk = '';
    let currentParagraphs = [];
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (\!trimmedParagraph) continue;
      
      currentParagraphs.push(trimmedParagraph);
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
      
      // チャンクサイズが指定サイズを超えたら、チャンクを確定
      const chunkSize = options?.chunkSize || 1000;
      if (currentChunk.length >= chunkSize) {
        chunks.push({
          document_id: documentId,
          content: currentChunk,
          metadata: {
            ...document.metadata,
            paragraphCount: currentParagraphs.length
          }
        });
        
        // 重複を考慮（オーバーラップ）
        const overlap = options?.chunkOverlap || 0;
        if (overlap > 0 && currentParagraphs.length > 1) {
          const overlapCount = Math.min(
            Math.ceil(currentParagraphs.length * (overlap / chunkSize)),
            currentParagraphs.length - 1
          );
          
          // 最後のN個の段落を次のチャンクに引き継ぐ
          currentParagraphs = currentParagraphs.slice(-overlapCount);
          currentChunk = currentParagraphs.join('\n\n');
        } else {
          currentParagraphs = [];
          currentChunk = '';
        }
      }
    }
    
    // 残りの段落があればチャンクに追加
    if (currentChunk) {
      chunks.push({
        document_id: documentId,
        content: currentChunk,
        metadata: {
          ...document.metadata,
          paragraphCount: currentParagraphs.length
        }
      });
    }
    
    return chunks;
  }

  /**
   * テキストをサイズベースでチャンク分割
   * @param document 文書
   * @param options チャンキングオプション
   * @returns チャンクの配列
   */
  private chunkBySize(document: Document, options?: ChunkingOptions): Chunk[] {
    const content = document.content;
    const documentId = document.id || 'temp-id';
    const chunkSize = options?.chunkSize || 1000;
    const chunkOverlap = options?.chunkOverlap || 100;
    
    const chunks: Chunk[] = [];
    let startIndex = 0;
    
    while (startIndex < content.length) {
      let endIndex = Math.min(startIndex + chunkSize, content.length);
      
      // 文の途中で切らないように調整
      if (endIndex < content.length) {
        // 次の文末まで進む（句点、改行など）
        const nextSentenceEnd = content.indexOf('.', endIndex);
        const nextParagraphEnd = content.indexOf('\n', endIndex);
        
        if (nextSentenceEnd \!== -1 && (nextParagraphEnd === -1 || nextSentenceEnd < nextParagraphEnd)) {
          endIndex = nextSentenceEnd + 1;
        } else if (nextParagraphEnd \!== -1 && nextParagraphEnd - endIndex < 100) {
          endIndex = nextParagraphEnd + 1;
        } else if (nextSentenceEnd \!== -1 && nextSentenceEnd - endIndex < 100) {
          endIndex = nextSentenceEnd + 1;
        }
      }
      
      // チャンクを作成
      const chunkContent = content.substring(startIndex, endIndex).trim();
      if (chunkContent) {
        chunks.push({
          document_id: documentId,
          content: chunkContent,
          metadata: {
            ...document.metadata,
            startPosition: startIndex,
            endPosition: endIndex
          }
        });
      }
      
      // 次のチャンクの開始位置を計算（オーバーラップを考慮）
      startIndex = Math.min(startIndex + chunkSize - chunkOverlap, endIndex);
    }
    
    return chunks;
  }
}

export default new Chunker();
