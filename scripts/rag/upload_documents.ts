import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables from .env file first
// Ensure we resolve the path to the root directory .env file
const rootDir = path.resolve(__dirname, '../../');
const envPath = path.resolve(rootDir, '.env');
console.log(`Loading environment variables from: ${envPath}`);
dotenv.config({ path: envPath });

// Now import the modules that depend on environment variables
import indexer from '../../src/modules/rag/indexer';
import chunker from '../../src/modules/rag/chunker';
import { Document } from '../../src/interfaces/rag';
import supabase from '../../src/config/supabase';
import logger from '../../src/utilities/logger';
import ragService from '../../src/services/supabase/ragService';

/**
 * 拡張メタデータインターフェース
 * RAG検索精度向上のための構造化されたメタデータ
 */
interface EnhancedMetadata {
  title: string;           // チャンクの具体的なタイトル（必須）
  summary: string;         // 内容の要約（必須）
  tags: string[];          // 検索タグ（必須）
  source_type: string;     // ソースタイプ（必須）
  document_title: string;  // 元ドキュメントのタイトル
  file_name: string;       // ファイル名（セキュリティ上の問題ない範囲で）
  created_at: string;      // 作成日時
}

/**
 * ファイル内容から要約テキストを生成
 * @param content ファイル内容
 * @param maxLength 最大文字数
 */
function generateSummary(content: string, maxLength: number = 300): string {
  // 改行・空白の正規化
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
 * テキストからタグを推定または抽出
 * @param content ファイル内容
 * @param fileName ファイル名
 * @param sourceType ソースタイプ
 */
function extractTags(content: string, fileName: string, sourceType: string): string[] {
  const tags: Set<string> = new Set();
  
  // ソースタイプを基本タグとして追加
  tags.add(sourceType);
  
  // ファイル名から推測
  const fileNameWords = fileName.toLowerCase()
    .replace(/[.-_]/g, ' ')
    .split(' ')
    .filter(word => word.length > 2);
  
  fileNameWords.forEach(word => tags.add(word));
  
  // 内容から頻出キーワード/特定パターンの抽出
  // 例: 大学、会社、製品名、人名など特徴的な単語を抽出
  const keywordPatterns = [
    /大学|学校|教育|学習/g,
    /会社|企業|組織/g,
    /製品|サービス|技術/g,
    /顧客|クライアント|ユーザー/g,
    /会議|ミーティング|打ち合わせ/g
  ];
  
  keywordPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => tags.add(match));
    }
  });
  
  // 最大10個までに制限
  return Array.from(tags).slice(0, 10);
}

/**
 * 見出しからタイトルを抽出または生成
 * @param content コンテンツ
 * @param fileName ファイル名（フォールバック用）
 */
function extractTitle(content: string, fileName: string): string {
  // Markdown見出しパターン
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }
  
  // 最初の行が短い場合はタイトルとして使用
  const firstLine = content.split('\n')[0].trim();
  if (firstLine.length < 100 && firstLine.length > 3) {
    return firstLine;
  }
  
  // ファイル名を整形（拡張子を除去、_や-をスペースに変換、大文字化）
  const formattedFileName = fileName
    .replace(/\.[^/.]+$/, "") // 拡張子削除
    .replace(/[-_]/g, " ")    // ハイフン、アンダースコアをスペースに
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  
  return formattedFileName;
}

/**
 * 拡張されたメタデータを生成
 */
function createEnhancedMetadata(
  content: string,
  sourceType: string,
  fileName: string,
  existingMetadata: Record<string, any> = {}
): EnhancedMetadata {
  // タイトルの抽出または生成
  const title = existingMetadata.title || extractTitle(content, fileName);
  
  // 要約の生成
  const summary = existingMetadata.summary || generateSummary(content);
  
  // タグの抽出
  const existingTags = Array.isArray(existingMetadata.tags) ? existingMetadata.tags : [];
  const extractedTags = extractTags(content, fileName, sourceType);
  const tags = [...new Set([...existingTags, ...extractedTags])];
  
  // ドキュメントタイトルの設定
  const documentTitle = existingMetadata.document_title || title;
  
  return {
    title,
    summary,
    tags,
    source_type: sourceType,
    document_title: documentTitle,
    file_name: fileName,
    created_at: existingMetadata.created_at || new Date().toISOString()
  };
}

/**
 * アップロードオプション
 */
interface UploadOptions {
  skipChunking?: boolean;  // チャンキングをスキップするか
  batchSize?: number;      // バッチサイズ
  verbose?: boolean;       // 詳細ログを出力するか
  useBatch?: boolean;      // バッチ処理を使うか
}

/**
 * フォルダ内のドキュメントをアップロード
 */
async function uploadFolder(folderPath: string, sourceType: 'faq' | 'event' | 'customer' | 'meeting_note' | 'system_info', options: UploadOptions = {}): Promise<void> {
  // ファイル一覧を取得
  const files = fs.readdirSync(folderPath);
  const verbose = options.verbose || false;
  
  if (verbose) {
    console.log(`フォルダ ${folderPath} 内に ${files.length} 個のファイルを発見`);
  } else {
    console.log(`${files.length} 個のファイルを処理します...`);
  }
  
  // 統計データの初期化
  let successCount = 0;
  let errorCount = 0;
  let chunkCount = 0;
  let skippedCount = 0;
  let updatedCount = 0;
  
  // ファイル処理ループ
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);
    
    // ディレクトリはスキップ
    if (!stats.isFile()) {
      if (verbose) console.log(`スキップ: ${filePath} (ディレクトリ)`);
      continue;
    }
    
    // 隠しファイルはスキップ
    if (file.startsWith('.')) {
      if (verbose) console.log(`スキップ: ${filePath} (隠しファイル)`);
      continue;
    }
    
    try {
      // コンテンツタイプとメタデータの検出
      const { detectedSourceType, metadata } = detectContentTypeAndMetadata(filePath, sourceType);
      
      if (verbose) {
        console.log(`処理中: ${filePath}`);
        console.log(`- コンテンツタイプ: ${detectedSourceType}`);
        console.log(`- メタデータ:`, metadata);
      }
      
      // ドキュメントを作成
      const document = await createDocumentFromFile(filePath, detectedSourceType, metadata);
      
      // 更新対応版の処理関数を使用
      const { docId, wasUpdated, skipReason, chunkCount: newChunkCount } = await processDocumentWithUpdate(document, filePath, options);
      
      // 統計更新
      if (skipReason) {
        if (verbose) console.log(`スキップ: ${skipReason}`);
        skippedCount++;
      } else if (wasUpdated) {
        updatedCount++;
      } else {
        successCount++;
      }
      
      // チャンク数を加算
      chunkCount += newChunkCount || 0;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`${file} の処理中にエラー: ${errorMessage}`, error);
      errorCount++;
    }
  }
  
  // 処理結果の表示
  console.log(`処理完了:`);
  console.log(`- 新規作成: ${successCount} ファイル`);
  console.log(`- 更新: ${updatedCount} ファイル`);
  console.log(`- スキップ: ${skippedCount} ファイル`);
  console.log(`- エラー: ${errorCount} ファイル`);
  
  if (!options.skipChunking) {
    console.log(`- 作成されたチャンク数: ${chunkCount}`);
  } else {
    console.log(`チャンキングはスキップされました`);
  }
}

/**
 * コンテンツタイプとメタデータの検出（拡張版）
 */
function detectContentTypeAndMetadata(filePath: string, defaultSourceType: 'faq' | 'event' | 'customer' | 'meeting_note' | 'system_info'): { 
  detectedSourceType: 'faq' | 'event' | 'customer' | 'meeting_note' | 'system_info', 
  metadata: EnhancedMetadata 
} {
  const fileExt = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  
  // ファイル内容の読み込み
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`ファイル読み込みエラー: ${filePath}`, error);
    // 最小限のメタデータで返す
    return { 
      detectedSourceType: defaultSourceType, 
      metadata: {
        title: fileName,
        summary: `${fileName}の内容`,
        tags: [defaultSourceType],
        source_type: defaultSourceType,
        document_title: fileName,
        file_name: fileName,
        created_at: new Date().toISOString()
      } 
    };
  }
  
  // JSONファイルの場合
  if (fileExt === '.json') {
    try {
      const jsonData = JSON.parse(content);
      const sourceType = jsonData.source_type || defaultSourceType;
      
      // JSONから既存のメタデータを取り出す
      const jsonMetadata = jsonData.metadata || {};
      
      // 拡張メタデータの生成（JSONデータを優先）
      const enhancedMetadata = createEnhancedMetadata(
        jsonData.content || content,
        sourceType,
        fileName,
        {
          ...jsonMetadata,
          title: jsonData.title || jsonMetadata.title,
          document_title: jsonData.title || jsonMetadata.document_title
        }
      );
      
      return {
        detectedSourceType: sourceType as any,
        metadata: enhancedMetadata
      };
    } catch (error) {
      console.error(`JSONパースエラー: ${filePath}`);
    }
  }
  
  // Markdownファイルの場合 - Front Matterを検出
  if (fileExt === '.md') {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontMatterRegex);
    
    let frontMatterData = {};
    let cleanContent = content;
    
    if (match && match[1]) {
      try {
        // フロントマターをパース
        frontMatterData = parseYamlLike(match[1]);
        // フロントマターを除去したコンテンツ
        cleanContent = content.replace(frontMatterRegex, '');
      } catch (error) {
        console.error(`Front Matterパースエラー: ${filePath}`);
      }
    }
    
    // ソースタイプの検出
    const sourceType = (frontMatterData as any).source_type || defaultSourceType;
    
    // 拡張メタデータの生成
    const enhancedMetadata = createEnhancedMetadata(
      cleanContent,
      sourceType,
      fileName,
      frontMatterData
    );
    
    return {
      detectedSourceType: sourceType as any,
      metadata: enhancedMetadata
    };
  }
  
  // パスからの推論
  const pathParts = filePath.toLowerCase().split('/');
  let inferredSourceType = defaultSourceType;
  
  // フォルダ名に基づく推論
  for (const part of pathParts) {
    if (part === 'faqs' || part === 'faq') inferredSourceType = 'faq';
    if (part === 'events' || part === 'event') inferredSourceType = 'event';
    if (part === 'customers' || part === 'customer') inferredSourceType = 'customer';
    if (part === 'meetings' || part === 'meeting_note') inferredSourceType = 'meeting_note';
    if (part === 'system' || part === 'system_info') inferredSourceType = 'system_info';
  }
  
  // コンテンツからの推論
  const inferredFromContent = inferSourceTypeFromContent(content);
  if (inferredFromContent) {
    inferredSourceType = inferredFromContent;
  }
  
  // 拡張メタデータの生成
  const enhancedMetadata = createEnhancedMetadata(
    content,
    inferredSourceType,
    fileName
  );
  
  return { 
    detectedSourceType: inferredSourceType, 
    metadata: enhancedMetadata 
  };
}

/**
 * コンテンツの内容からソースタイプを推論する
 * @param content ドキュメントの内容
 * @returns 推論されたソースタイプ、または null（推論できない場合）
 */
function inferSourceTypeFromContent(content: string): 'faq' | 'event' | 'customer' | 'meeting_note' | 'system_info' | null {
  // 内容を正規化
  const normalizedContent = content.toLowerCase();
  
  // FAQ特有のパターン
  if (
    normalizedContent.includes('よくある質問') || 
    normalizedContent.includes('faq') || 
    normalizedContent.includes('frequently asked') || 
    /q[\s]*[\.:].*\n.*a[\s]*[\.:]/.test(normalizedContent) ||  // Q: ... A: パターン
    /質問[\s]*[\.:].*\n.*回答[\s]*[\.:]/.test(normalizedContent)    // 質問: ... 回答: パターン
  ) {
    return 'faq';
  }
  
  // イベント特有のパターン
  if (
    normalizedContent.includes('イベント') || 
    normalizedContent.includes('セミナー') || 
    normalizedContent.includes('講演会') || 
    normalizedContent.includes('開催日') || 
    normalizedContent.includes('会場') || 
    /\d{4}[\/-]\d{1,2}[\/-]\d{1,2}.*開催/.test(normalizedContent) ||  // 日付 + 開催
    /場所.*[:：]/.test(normalizedContent)
  ) {
    return 'event';
  }
  
  // 顧客情報特有のパターン
  if (
    normalizedContent.includes('顧客情報') || 
    normalizedContent.includes('お客様情報') || 
    normalizedContent.includes('取引先') || 
    normalizedContent.includes('customer') || 
    normalizedContent.includes('client') || 
    /会社名.*[:：]/.test(normalizedContent) ||
    /取引.*[:：]/.test(normalizedContent)
  ) {
    return 'customer';
  }
  
  // 議事録特有のパターン
  if (
    normalizedContent.includes('議事録') || 
    normalizedContent.includes('ミーティング') || 
    normalizedContent.includes('打ち合わせ') || 
    normalizedContent.includes('meeting note') || 
    normalizedContent.includes('meeting minutes') || 
    /日時.*[:：].*\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/.test(normalizedContent) ||  // 日時: YYYY/MM/DD
    /出席者.*[:：]/.test(normalizedContent) ||  // 出席者:
    /議題.*[:：]/.test(normalizedContent)   // 議題:
  ) {
    return 'meeting_note';
  }
  
  // システム情報特有のパターン
  if (
    normalizedContent.includes('システム') || 
    normalizedContent.includes('マニュアル') || 
    normalizedContent.includes('手順書') || 
    normalizedContent.includes('system') || 
    normalizedContent.includes('manual') || 
    normalizedContent.includes('procedure') || 
    normalizedContent.includes('ガイドライン') || 
    /version.*[:：]/.test(normalizedContent) ||
    /バージョン.*[:：]/.test(normalizedContent)
  ) {
    return 'system_info';
  }
  
  // 推論できない場合はnullを返す
  return null;
}

/**
 * 簡易的なYAMLっぽいフォーマットのパース関数
 */
function parseYamlLike(text: string): any {
  const result: any = {};
  const lines = text.split('\n');
  
  for (const line of lines) {
    const matches = line.match(/^\s*([^:]+):\s*(.*)$/);
    if (matches && matches.length === 3) {
      const [_, key, value] = matches;
      result[key.trim()] = value.trim();
    }
  }
  
  return result;
}

/**
 * ファイルからドキュメントを作成（拡張版）
 */
async function createDocumentFromFile(
  filePath: string, 
  sourceType: 'faq' | 'event' | 'customer' | 'meeting_note' | 'system_info', 
  metadata: EnhancedMetadata
): Promise<Document> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileExt = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  
  // JSONファイルの場合は直接オブジェクトとして解析
  if (fileExt === '.json') {
    try {
      const jsonData = JSON.parse(content);
      return {
        title: jsonData.title || metadata.title,
        content: jsonData.content || content,
        source_type: sourceType,
        metadata: metadata
      };
    } catch (error) {
      // JSONパースエラーの場合は通常のテキストとして扱う
      console.error(`JSONパースエラー、テキストとして処理: ${filePath}`);
    }
  }
  
  // Markdownファイルの場合はFrontMatterを除去
  if (fileExt === '.md') {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const cleanContent = content.replace(frontMatterRegex, '');
    
    return {
      title: metadata.title,
      content: cleanContent,
      source_type: sourceType,
      metadata
    };
  }
  
  // デフォルトはテキストファイルとして処理
  return {
    title: metadata.title,
    content,
    source_type: sourceType,
    metadata
  };
}

/**
 * ドキュメントの一意識別子を生成
 */
function generateDocumentId(document: Document, filePath: string): string {
  // 1. メタデータ内のdocument_idを優先
  if (document.metadata && document.metadata.document_id) {
    return document.metadata.document_id;
  }
  
  // 2. 相対パスをIDとして使用（ベースディレクトリからの相対パス）
  const basePath = process.cwd();
  let relativePath = filePath;
  if (filePath.startsWith(basePath)) {
    relativePath = filePath.substring(basePath.length);
  }
  // パスの正規化（先頭のスラッシュを除去など）
  relativePath = relativePath.replace(/^\/+/, '');
  
  // 3. それでも不十分な場合はハッシュを生成
  if (!relativePath) {
    const content = `${document.title}:${document.content.substring(0, 200)}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }
  
  return relativePath;
}

/**
 * ドキュメント内容のハッシュを計算
 */
function calculateDocumentHash(document: Document): string {
  const content = `${document.title}:${document.content}:${JSON.stringify(document.metadata)}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * 既存ドキュメントと新ドキュメントの比較
 */
async function isDocumentChanged(existingDocId: string, newDocument: Document): Promise<boolean> {
  try {
    // 既存ドキュメントを取得
    const { data, error } = await supabase
      .from('documents')
      .select('title, content, metadata')
      .eq('id', existingDocId)
      .single();

    if (error || !data) {
      // エラーまたはデータがない場合は変更ありとして扱う
      return true;
    }
    
    // 既存ドキュメントのハッシュを計算
    const existingHash = calculateDocumentHash({
      title: data.title,
      content: data.content,
      source_type: newDocument.source_type,
      metadata: data.metadata || {}
    });
    
    // 新ドキュメントのハッシュを計算
    const newHash = calculateDocumentHash(newDocument);
    
    // ハッシュの比較
    return existingHash !== newHash;
  } catch (error) {
    console.error('ドキュメント比較エラー:', error);
    // エラーの場合は変更ありとして扱う
    return true;
  }
}

/**
 * 既存ドキュメントの検出と削除（更新用）
 */
async function findAndRemoveExistingDocument(documentId: string, sourceType: 'faq' | 'event' | 'customer' | 'meeting_note' | 'system_info'): Promise<string | null> {
  try {
    // 1. まず、document_idをメタデータに持つドキュメントを検索
    let query = supabase
      .from('documents')
      .select('id')
      .eq('source_type', sourceType)
      .contains('metadata', { document_id: documentId });
    
    let { data, error } = await query;
    
    if (error) {
      console.error('ドキュメント検索エラー:', error);
      return null;
    }
    
    // 2. 見つからない場合、ファイルパスをメタデータに持つドキュメントを検索
    if (!data || data.length === 0) {
      query = supabase
        .from('documents')
        .select('id')
        .eq('source_type', sourceType)
        .contains('metadata', { file_path: documentId });
      
      const result = await query;
      if (result.error) {
        console.error('ドキュメント検索エラー(パス):', result.error);
        return null;
      }
      
      data = result.data;
    }
    
    // 3. 既存ドキュメントが見つかった場合
    if (data && data.length > 0) {
      const existingDocId = data[0].id;
      
      // 先に古いチャンクを削除
      const { error: chunkDeleteError } = await supabase
        .from('chunks')
        .delete()
        .eq('document_id', existingDocId);
      
      if (chunkDeleteError) {
        console.error('チャンク削除エラー:', chunkDeleteError);
      } else {
        console.log('ドキュメント ' + existingDocId + ' の古いチャンクを削除しました');
      }
      
      return existingDocId;
    }
    
    return null;
  } catch (error) {
    console.error('既存ドキュメント検索エラー:', error);
    return null;
  }
}

/**
 * ドキュメントのアップロードとインデックス化（更新対応版）
 */
async function processDocumentWithUpdate(document: Document, filePath: string, options: UploadOptions = {}): Promise<{docId: string, wasUpdated: boolean, skipReason?: string, chunkCount: number}> {
  try {
    // ドキュメントIDの生成
    const documentId = generateDocumentId(document, filePath);
    console.log(`ドキュメントID: ${documentId}`);
    
    // メタデータにdocument_idを追加
    if (!document.metadata) document.metadata = {};
    document.metadata.document_id = documentId;
    
    // 既存ドキュメントの検索と準備
    const existingDocId = await findAndRemoveExistingDocument(documentId, document.source_type);
    
    let docId;
    let wasUpdated = false;
    let newChunkCount = 0;
    
    if (existingDocId) {
      // 既存ドキュメントと新ドキュメントを比較
      const hasChanged = await isDocumentChanged(existingDocId, document);
      
      if (hasChanged) {
        // 変更がある場合のみ更新
        const { error } = await supabase
          .from('documents')
          .update({
            title: document.title,
            content: document.content,
            metadata: document.metadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDocId);
        
        if (error) {
          console.error('ドキュメント更新エラー:', error);
          throw error;
        }
        
        docId = existingDocId;
        wasUpdated = true;
        console.log(`ドキュメント ${docId} を更新しました`);
      } else {
        // 変更がない場合は処理をスキップ
        docId = existingDocId;
        console.log(`ドキュメント ${docId} に変更がないためスキップします`);
        
        // チャンキングもスキップ
        return { docId, wasUpdated: false, skipReason: '変更なし', chunkCount: 0 };
      }
    } else {
      // 新規ドキュメントを作成
      docId = await indexer.indexDocument(document);
      console.log(`新規ドキュメント ${docId} を作成しました`);
    }
    
    // チャンキングをスキップするオプションがない場合
    if (!options.skipChunking) {
      // チャンキングとインデックス化を実行
      const chunks = chunker.chunkDocument(document);
      console.log(`${chunks.length}個のチャンクを作成`);
      
      // チャンク数を記録
      newChunkCount = chunks.length;
      
      // チャンクをバッチでインデックス化
      await ragService.saveChunks(chunks.map((chunk) => {
        chunk.document_id = docId;
        return chunk;
      }));
      
      console.log(`すべてのチャンクをインデックス化完了`);
    }
    
    return { docId, wasUpdated, chunkCount: newChunkCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`ドキュメント処理エラー: ${errorMessage}`);
    throw error;
  }
}

/**
 * ドキュメントIDに基づいて完全削除
 */
async function deleteDocument(documentId: string): Promise<boolean> {
  try {
    // まずドキュメントを検索
    const { data, error } = await supabase
      .from('documents')
      .select('id')
      .contains('metadata', { document_id: documentId });
    
    if (error) {
      console.error('ドキュメント検索エラー:', error);
      return false;
    }
    
    if (!data || data.length === 0) {
      console.log(`ID ${documentId} に一致するドキュメントが見つかりません`);
      return false;
    }
    
    const docId = data[0].id;
    
    // まずチャンクを削除
    const { error: chunkDeleteError } = await supabase
      .from('chunks')
      .delete()
      .eq('document_id', docId);
    
    if (chunkDeleteError) {
      console.error('チャンク削除エラー:', chunkDeleteError);
      return false;
    }
    
    // 次にドキュメントを削除
    const { error: docDeleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);
    
    if (docDeleteError) {
      console.error('ドキュメント削除エラー:', docDeleteError);
      return false;
    }
    
    console.log('ドキュメント ' + documentId + ' (内部ID: ' + docId + ') を完全に削除しました');
    return true;
  } catch (error) {
    console.error('ドキュメント削除処理エラー:', error);
    return false;
  }
}

/**
 * メイン実行関数
 */
async function main() {
  // コマンドライン引数の解析
  const args = process.argv.slice(2);
  let folderPath = '';
  let sourceType: 'faq' | 'event' | 'customer' | 'meeting_note' | 'system_info' = 'system_info';
  const options: UploadOptions = {
    skipChunking: false,
    verbose: false,
    useBatch: false
  };
  
  // 引数解析
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--skip-chunking') {
      options.skipChunking = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--batch' || arg === '-b') {
      options.useBatch = true;

      const batchSizeArg = args[i+1];
      if (batchSizeArg && !batchSizeArg.startsWith("-")) {
        options.batchSize = parseInt(batchSizeArg, 10);
        i++;
      }
    } else if (arg === '--source-type' || arg === '-t') {
      const typeArg = args[++i];
      if (typeArg && ['faq', 'event', 'customer', 'meeting_note', 'system_info'].includes(typeArg)) {
        sourceType = typeArg as 'faq' | 'event' | 'customer' | 'meeting_note' | 'system_info';
      } else {
        console.error(`無効なソースタイプです: ${typeArg}`);
        console.error('有効なソースタイプ: faq, event, customer, meeting_note, system_info');
        process.exit(1);
      }
    } else if (arg === '--delete' || arg === '-d') {
      const deleteId = args[++i];

      if (!deleteId) {
        console.error("削除するドキュメントIDを指定してください");
        process.exit(1);
      }
      
      const success = await deleteDocument(deleteId);
      if (success) {
        console.log('ドキュメント ' + deleteId + ' の削除に成功しました');
      } else {
        console.error('ドキュメント ' + deleteId + ' の削除に失敗しました');
      }

      process.exit(0);
    } else if (!folderPath) {
      folderPath = arg;
    }
  }
  
  if (!folderPath) {
    console.log('使用法: ts-node upload_documents.ts <folder_path> [options]');

    console.log('  --skip-chunking           チャンキング処理をスキップ');
    console.log('  --verbose, -v             詳細なログを表示');
    console.log('  --batch, -b [size]        バッチ処理を有効化（オプションでサイズ指定）');
    console.log('  --delete, -d <id>         指定IDのドキュメントを削除');
    process.exit(1);
  }
  
  console.log('フォルダ: ' + folderPath);
  console.log('ソースタイプ: ' + sourceType);
  console.log('オプション: ' + JSON.stringify(options));
  
  try {
    await uploadFolder(folderPath, sourceType, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`アップロード処理中にエラーが発生しました: ${errorMessage}`, error);
    process.exit(1);
  }
}

// スクリプト実行
main().catch(console.error);
