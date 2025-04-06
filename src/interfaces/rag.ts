/**
 * RAGシステムの型定義
 */

// ドキュメントの型定義
export interface Document {
  id?: string;
  title: string;
  content: string;
  source_type: 'faq' | 'event' | 'customer' | 'meeting_note' | 'system_info';
  source_id?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

// チャンクの型定義
export interface Chunk {
  id?: string;
  document_id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

// 検索クエリの型定義
export interface SearchQuery {
  query: string;
  filters?: Record<string, any>;
  limit?: number;
}

// 検索結果の型定義
export interface SearchResult {
  content: string;
  metadata?: Record<string, any>;
  similarity?: number;
  source_type?: string;
  source_id?: string;
}

// ベクトル検索結果の型定義
export interface VectorSearchResult {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  similarity: number;
  document_id: string;
  documents?: {
    id: string;
    title: string;
    source_type: string;
    source_id?: string;
  };
}

// チャンキングオプションの型定義
export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  customSplitter?: RegExp;
}

// ソースタイプに基づく特別なメタデータの型定義
export interface FAQMetadata {
  category?: string;
  tags?: string[];
}

export interface EventMetadata {
  eventId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location: string;
  capacity?: number;
  price?: number;
}

export interface CustomerMetadata {
  customerId: string;
  name: string;
  email?: string;
  allergies?: string[];
  preferences?: string[];
}

export interface MeetingNoteMetadata {
  meetingId: string;
  meetingTitle: string;
  meetingDate: Date;
  participants: string[];
  sectionTitle?: string;
}
