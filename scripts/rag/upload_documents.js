"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv = __importStar(require("dotenv"));
// Load environment variables from .env file first
// Ensure we resolve the path to the root directory .env file
const rootDir = path.resolve(__dirname, '../../');
const envPath = path.resolve(rootDir, '.env');
console.log(`Loading environment variables from: ${envPath}`);
dotenv.config({ path: envPath });
// Now import the modules that depend on environment variables
const indexer_1 = __importDefault(require("../../src/modules/rag/indexer"));
const chunker_1 = __importDefault(require("../../src/modules/rag/chunker"));
const supabase_1 = __importDefault(require("../../src/config/supabase"));
const ragService_1 = __importDefault(require("../../src/services/supabase/ragService"));
/**
 * フォルダ内のドキュメントをアップロード
 */
async function uploadFolder(folderPath, sourceType, options = {}) {
    // ファイル一覧を取得
    const files = fs.readdirSync(folderPath);
    const verbose = options.verbose || false;
    if (verbose) {
        console.log(`フォルダ ${folderPath} 内に ${files.length} 個のファイルを発見`);
    }
    else {
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
            if (verbose)
                console.log(`スキップ: ${filePath} (ディレクトリ)`);
            continue;
        }
        // 隠しファイルはスキップ
        if (file.startsWith('.')) {
            if (verbose)
                console.log(`スキップ: ${filePath} (隠しファイル)`);
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
                if (verbose)
                    console.log(`スキップ: ${skipReason}`);
                skippedCount++;
            }
            else if (wasUpdated) {
                updatedCount++;
            }
            else {
                successCount++;
            }
            // チャンク数を加算
            chunkCount += newChunkCount || 0;
        }
        catch (error) {
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
    }
    else {
        console.log(`チャンキングはスキップされました`);
    }
}
/**
 * コンテンツタイプとメタデータの検出
 */
function detectContentTypeAndMetadata(filePath, defaultSourceType) {
    const fileExt = path.extname(filePath).toLowerCase();
    // ファイル内容の読み込み
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    }
    catch (error) {
        console.error(`ファイル読み込みエラー: ${filePath}`, error);
        return { detectedSourceType: defaultSourceType, metadata: { file_path: filePath } };
    }
    // JSONファイルの場合
    if (fileExt === '.json') {
        try {
            const jsonData = JSON.parse(content);
            return {
                detectedSourceType: jsonData.source_type || defaultSourceType,
                metadata: jsonData.metadata || { file_path: filePath }
            };
        }
        catch (error) {
            console.error(`JSONパースエラー: ${filePath}`);
            return { detectedSourceType: defaultSourceType, metadata: { file_path: filePath } };
        }
    }
    // Markdownファイルの場合 - Front Matterを検出
    if (fileExt === '.md') {
        const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        const match = content.match(frontMatterRegex);
        if (match && match[1]) {
            try {
                // YAMLっぽいフォーマットをパース
                const frontMatter = parseYamlLike(match[1]);
                return {
                    detectedSourceType: frontMatter.source_type || defaultSourceType,
                    metadata: { ...frontMatter, file_path: filePath }
                };
            }
            catch (error) {
                console.error(`Front Matterパースエラー: ${filePath}`);
            }
        }
    }
    // パスからの推論
    const pathParts = filePath.toLowerCase().split('/');
    // フォルダ名に基づく推論
    for (const part of pathParts) {
        if (part === 'faqs' || part === 'faq')
            return { detectedSourceType: 'faq', metadata: { file_path: filePath } };
        if (part === 'events' || part === 'event')
            return { detectedSourceType: 'event', metadata: { file_path: filePath } };
        if (part === 'customers' || part === 'customer')
            return { detectedSourceType: 'customer', metadata: { file_path: filePath } };
        if (part === 'meetings' || part === 'meeting_note')
            return { detectedSourceType: 'meeting_note', metadata: { file_path: filePath } };
        if (part === 'system' || part === 'system_info')
            return { detectedSourceType: 'system_info', metadata: { file_path: filePath } };
    }
    // デフォルト値を返す
    return { detectedSourceType: defaultSourceType, metadata: { file_path: filePath } };
}
/**
 * 簡易的なYAMLっぽいフォーマットのパース関数
 */
function parseYamlLike(text) {
    const result = {};
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
 * ファイルからドキュメントを作成
 */
async function createDocumentFromFile(filePath, sourceType, metadata) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileExt = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, fileExt);
    // JSONファイルの場合は直接オブジェクトとして解析
    if (fileExt === '.json') {
        try {
            const jsonData = JSON.parse(content);
            return {
                title: jsonData.title || fileName,
                content: jsonData.content || content,
                source_type: sourceType,
                metadata: { ...metadata, ...jsonData.metadata }
            };
        }
        catch (error) {
            // JSONパースエラーの場合は通常のテキストとして扱う
            console.error(`JSONパースエラー、テキストとして処理: ${filePath}`);
        }
    }
    // Markdownファイルの場合はFrontMatterを除去
    if (fileExt === '.md') {
        const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        const cleanContent = content.replace(frontMatterRegex, '');
        // タイトルを抽出（最初の# 行）
        const titleMatch = cleanContent.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : fileName;
        return {
            title,
            content: cleanContent,
            source_type: sourceType,
            metadata
        };
    }
    // デフォルトはテキストファイルとして処理
    return {
        title: fileName,
        content,
        source_type: sourceType,
        metadata
    };
}
/**
 * ドキュメントの一意識別子を生成
 */
function generateDocumentId(document, filePath) {
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
        return crypto_1.default.createHash('md5').update(content).digest('hex');
    }
    return relativePath;
}
/**
 * ドキュメント内容のハッシュを計算
 */
function calculateDocumentHash(document) {
    const content = `${document.title}:${document.content}:${JSON.stringify(document.metadata)}`;
    return crypto_1.default.createHash('md5').update(content).digest('hex');
}
/**
 * 既存ドキュメントと新ドキュメントの比較
 */
async function isDocumentChanged(existingDocId, newDocument) {
    try {
        // 既存ドキュメントを取得
        const { data, error } = await supabase_1.default
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
    }
    catch (error) {
        console.error('ドキュメント比較エラー:', error);
        // エラーの場合は変更ありとして扱う
        return true;
    }
}
/**
 * 既存ドキュメントの検出と削除（更新用）
 */
async function findAndRemoveExistingDocument(documentId, sourceType) {
    try {
        // 1. まず、document_idをメタデータに持つドキュメントを検索
        let query = supabase_1.default
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
            query = supabase_1.default
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
            const { error: chunkDeleteError } = await supabase_1.default
                .from('chunks')
                .delete()
                .eq('document_id', existingDocId);
            if (chunkDeleteError) {
                console.error('チャンク削除エラー:', chunkDeleteError);
            }
            else {
                console.log('ドキュメント ' + existingDocId + ' の古いチャンクを削除しました');
            }
            return existingDocId;
        }
        return null;
    }
    catch (error) {
        console.error('既存ドキュメント検索エラー:', error);
        return null;
    }
}
/**
 * ドキュメントのアップロードとインデックス化（更新対応版）
 */
async function processDocumentWithUpdate(document, filePath, options = {}) {
    try {
        // ドキュメントIDの生成
        const documentId = generateDocumentId(document, filePath);
        console.log(`ドキュメントID: ${documentId}`);
        // メタデータにdocument_idを追加
        if (!document.metadata)
            document.metadata = {};
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
                const { error } = await supabase_1.default
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
            }
            else {
                // 変更がない場合は処理をスキップ
                docId = existingDocId;
                console.log(`ドキュメント ${docId} に変更がないためスキップします`);
                // チャンキングもスキップ
                return { docId, wasUpdated: false, skipReason: '変更なし', chunkCount: 0 };
            }
        }
        else {
            // 新規ドキュメントを作成
            docId = await indexer_1.default.indexDocument(document);
            console.log(`新規ドキュメント ${docId} を作成しました`);
        }
        // チャンキングをスキップするオプションがない場合
        if (!options.skipChunking) {
            // チャンキングとインデックス化を実行
            const chunks = chunker_1.default.chunkDocument(document);
            console.log(`${chunks.length}個のチャンクを作成`);
            // チャンク数を記録
            newChunkCount = chunks.length;
            // チャンクをバッチでインデックス化
            await ragService_1.default.saveChunks(chunks.map((chunk) => {
                chunk.document_id = docId;
                return chunk;
            }));
            console.log(`すべてのチャンクをインデックス化完了`);
        }
        return { docId, wasUpdated, chunkCount: newChunkCount };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`ドキュメント処理エラー: ${errorMessage}`);
        throw error;
    }
}
/**
 * ドキュメントIDに基づいて完全削除
 */
async function deleteDocument(documentId) {
    try {
        // まずドキュメントを検索
        const { data, error } = await supabase_1.default
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
        const { error: chunkDeleteError } = await supabase_1.default
            .from('chunks')
            .delete()
            .eq('document_id', docId);
        if (chunkDeleteError) {
            console.error('チャンク削除エラー:', chunkDeleteError);
            return false;
        }
        // 次にドキュメントを削除
        const { error: docDeleteError } = await supabase_1.default
            .from('documents')
            .delete()
            .eq('id', docId);
        if (docDeleteError) {
            console.error('ドキュメント削除エラー:', docDeleteError);
            return false;
        }
        console.log('ドキュメント ' + documentId + ' (内部ID: ' + docId + ') を完全に削除しました');
        return true;
    }
    catch (error) {
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
    let sourceType = 'system_info';
    const options = {
        skipChunking: false,
        verbose: false,
        useBatch: false
    };
    // 引数解析
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--skip-chunking') {
            options.skipChunking = true;
        }
        else if (arg === '--verbose' || arg === '-v') {
            options.verbose = true;
        }
        else if (arg === '--batch' || arg === '-b') {
            options.useBatch = true;
            const batchSizeArg = args[i + 1];
            if (batchSizeArg && !batchSizeArg.startsWith("-")) {
                options.batchSize = parseInt(batchSizeArg, 10);
                i++;
            }
        }
        else if (arg === '--source-type' || arg === '-t') {
            const typeArg = args[++i];
            if (typeArg && ['faq', 'event', 'customer', 'meeting_note', 'system_info'].includes(typeArg)) {
                sourceType = typeArg;
            }
            else {
                console.error(`無効なソースタイプです: ${typeArg}`);
                console.error('有効なソースタイプ: faq, event, customer, meeting_note, system_info');
                process.exit(1);
            }
        }
        else if (arg === '--delete' || arg === '-d') {
            const deleteId = args[++i];
            if (!deleteId) {
                console.error("削除するドキュメントIDを指定してください");
                process.exit(1);
            }
            const success = await deleteDocument(deleteId);
            if (success) {
                console.log('ドキュメント ' + deleteId + ' の削除に成功しました');
            }
            else {
                console.error('ドキュメント ' + deleteId + ' の削除に失敗しました');
            }
            process.exit(0);
        }
        else if (!folderPath) {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`アップロード処理中にエラーが発生しました: ${errorMessage}`, error);
        process.exit(1);
    }
}
// スクリプト実行
main().catch(console.error);
