// src/scripts/upload-test-documents.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';

// 環境変数の読み込み
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// OpenAI クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supabase クライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase環境変数が設定されていません');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// インターフェース定義
interface Document {
  id?: string;
  title: string;
  content: string;
  source_type: string;
  source_id?: string;
  metadata?: Record<string, any>;
}

interface Chunk {
  id?: string;
  document_id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
}

// チャンキング機能
async function chunkDocument(doc: Document): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  
  // セクションごとにチャンキング（マークダウンの見出しで分割）
  const sections = doc.content.split(/(?=^#{1,3}\s+.+$)/m);
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (section.length === 0) continue;
    
    // セクションタイトルを抽出
    const titleMatch = section.match(/^(#{1,3})\s+(.+)$/m);
    const sectionTitle = titleMatch ? titleMatch[2] : `セクション ${i + 1}`;
    const headingLevel = titleMatch ? titleMatch[1].length : 0;
    
    // 適切なサイズのチャンクに分割（大きすぎる場合は更に分割）
    if (section.length > 1000) {
      // 段落ごとに分割
      const paragraphs = section.split(/\n\n+/);
      
      // 複数の段落をまとめて適切なサイズのチャンクにする
      let currentChunk = '';
      let currentChunkTitle = sectionTitle;
      
      for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length > 1000) {
          // チャンクが大きくなりすぎたら保存して新しいチャンクを開始
          if (currentChunk) {
            chunks.push({
              document_id: doc.id || '',
              content: currentChunk.trim(),
              metadata: {
                title: currentChunkTitle,
                section: sectionTitle,
                heading_level: headingLevel,
                source_type: doc.source_type,
                ...doc.metadata
              }
            });
          }
          currentChunk = paragraph;
        } else {
          // 現在のチャンクに段落を追加
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
      }
      
      // 最後のチャンクを追加
      if (currentChunk) {
        chunks.push({
          document_id: doc.id || '',
          content: currentChunk.trim(),
          metadata: {
            title: currentChunkTitle,
            section: sectionTitle,
            heading_level: headingLevel,
            source_type: doc.source_type,
            ...doc.metadata
          }
        });
      }
    } else {
      // 小さいセクションはそのまま1つのチャンクとして追加
      chunks.push({
        document_id: doc.id || '',
        content: section,
        metadata: {
          title: sectionTitle,
          heading_level: headingLevel,
          source_type: doc.source_type,
          ...doc.metadata
        }
      });
    }
  }
  
  return chunks;
}

// OpenAIの埋め込みを生成
async function generateEmbeddings(chunks: Chunk[]): Promise<Chunk[]> {
  const embeddedChunks: Chunk[] = [];
  
  // チャンクごとに埋め込みを生成（APIレート制限を考慮）
  for (let i = 0; i < chunks.length; i++) {
    try {
      const chunk = chunks[i];
      
      // OpenAI API を使用して埋め込みを生成
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk.content,
      });
      
      const embedding = response.data[0].embedding;
      embeddedChunks.push({
        ...chunk,
        embedding
      });
      
      // APIレート制限を回避するための遅延（必要に応じて調整）
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(`埋め込み生成完了: チャンク ${i + 1}/${chunks.length}`);
    } catch (error) {
      console.error(`埋め込み生成エラー: チャンク ${i + 1}/${chunks.length}`, error);
      throw error;
    }
  }
  
  return embeddedChunks;
}

// ドキュメントとチャンクをSupabaseに保存
async function saveToSupabase(doc: Document, chunks: Chunk[]): Promise<void> {
  try {
    // ドキュメントの保存
    const { data: documentData, error: documentError } = await supabase
      .from('documents')
      .insert([{
        title: doc.title,
        content: doc.content,
        source_type: doc.source_type,
        source_id: doc.source_id,
        metadata: doc.metadata
      }])
      .select('id');
    
    if (documentError) {
      throw new Error(`ドキュメント保存エラー: ${documentError.message}`);
    }
    
    const documentId = documentData[0].id;
    console.log(`ドキュメント保存完了: ID ${documentId}`);
    
    // チャンクの保存（ドキュメントIDを設定）
    const chunksToSave = chunks.map(chunk => ({
      ...chunk,
      document_id: documentId
    }));
    
    // チャンクをバッチで保存（大量のデータがある場合は分割が必要）
    const batchSize = 10;
    for (let i = 0; i < chunksToSave.length; i += batchSize) {
      const batch = chunksToSave.slice(i, i + batchSize);
      const { error: chunkError } = await supabase
        .from('chunks')
        .insert(batch);
      
      if (chunkError) {
        throw new Error(`チャンク保存エラー: ${chunkError.message}`);
      }
      
      console.log(`チャンクバッチ保存完了: ${i + 1}〜${Math.min(i + batchSize, chunksToSave.length)}/${chunksToSave.length}`);
    }
    
    console.log(`全てのチャンク保存完了: 合計 ${chunksToSave.length} チャンク`);
  } catch (error) {
    console.error('Supabaseへの保存中にエラーが発生しました:', error);
    throw error;
  }
}

// ファイルからドキュメントを読み込む
function readDocumentFromFile(filePath: string, sourceType: string): Document {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  
  return {
    title: fileName.replace(/\.[^/.]+$/, ''), // 拡張子を除いたファイル名
    content,
    source_type: sourceType,
    metadata: {
      file_path: filePath,
      file_name: fileName,
      created_at: new Date().toISOString()
    }
  };
}

// テストドキュメントをアップロード
async function uploadTestDocument(filePath: string, sourceType: string): Promise<void> {
  try {
    console.log(`ファイル "${filePath}" のアップロードを開始します...`);
    
    // ファイルからドキュメントを読み込む
    const document = readDocumentFromFile(filePath, sourceType);
    
    // ドキュメントをチャンキング
    const chunks = await chunkDocument(document);
    console.log(`チャンキング完了: ${chunks.length} チャンク作成`);
    
    // 埋め込みを生成
    const embeddedChunks = await generateEmbeddings(chunks);
    console.log(`埋め込み生成完了: ${embeddedChunks.length} チャンク`);
    
    // Supabaseに保存
    await saveToSupabase(document, embeddedChunks);
    console.log(`ドキュメント "${document.title}" のアップロードが完了しました`);
  } catch (error) {
    console.error('アップロード処理中にエラーが発生しました:', error);
  }
}

// メイン処理
async function main() {
  try {
    // テストのために特定のファイルパスを指定
    const filePath = '/home/tukapontas/ai-secretary2/test-docs/harappa-unv.md';
    
    // ファイルをアップロード（ソースタイプは適宜変更）
    await uploadTestDocument(filePath, 'organization_info');
    
    console.log('テストドキュメントのアップロードが完了しました');
  } catch (error) {
    console.error('メイン処理中にエラーが発生しました:', error);
  }
}

// スクリプトの実行
main();
