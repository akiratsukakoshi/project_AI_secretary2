"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_1 = require("../../config/supabase");
var dotenv = require("dotenv");
// 環境変数をロード
dotenv.config();
/**
 * RAGサービス - Supabase連携
 * ベクトル検索とRAG関連のデータアクセスを処理する
 */
var RAGService = /** @class */ (function () {
    function RAGService() {
    }
    /**
     * チャンクをバッチでSupabaseに保存
     * @param chunks 保存するチャンクの配列
     * @returns 成功したか
     */
    RAGService.prototype.saveChunks = function (chunks) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, chunks_1, chunk, error, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!chunks || chunks.length === 0) {
                            console.warn('保存するチャンクがありません');
                            return [2 /*return*/, true];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        _i = 0, chunks_1 = chunks;
                        _a.label = 2;
                    case 2:
                        if (!(_i < chunks_1.length)) return [3 /*break*/, 5];
                        chunk = chunks_1[_i];
                        return [4 /*yield*/, supabase_1.default
                                .from('chunks')
                                .insert({
                                id: chunk.id,
                                document_id: chunk.document_id,
                                content: chunk.content,
                                // 埋め込みは一時的に省略
                                // embedding: chunk.embedding,
                                metadata: chunk.metadata || {},
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            })];
                    case 3:
                        error = (_a.sent()).error;
                        if (error) {
                            console.error('チャンク保存エラー:', error);
                            // 個別のエラーでは全体を失敗としない（より堅牢な実装）
                            console.warn("\u30C1\u30E3\u30F3\u30AF\u4FDD\u5B58\u5931\u6557: document_id=".concat(chunk.document_id));
                        }
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, true];
                    case 6:
                        error_1 = _a.sent();
                        console.error('チャンクのバッチ保存エラー:', error_1);
                        throw new Error('チャンクのバッチ保存に失敗しました');
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 検索クエリを実行する（単純なキーワード検索）
     * @param query 検索クエリ
     * @returns 検索結果の配列
     */
    RAGService.prototype.search = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, supabase_1.default
                                .from('chunks')
                                .select("\n          id,\n          content,\n          metadata,\n          document_id,\n          documents:document_id (\n            id,\n            title,\n            source_type,\n            source_id\n          )\n        ")
                                .ilike('content', "%".concat(query.query, "%"))
                                .limit(query.limit || 5)];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error('検索エラー:', error);
                            throw error;
                        }
                        // 検索結果がない場合は空配列を返す
                        if (!data || data.length === 0) {
                            return [2 /*return*/, []];
                        }
                        // 検索結果を整形
                        return [2 /*return*/, data.map(function (item) {
                                var _a, _b;
                                return ({
                                    content: item.content,
                                    metadata: item.metadata,
                                    similarity: 1.0, // 仮の類似度
                                    source_type: (_a = item.documents) === null || _a === void 0 ? void 0 : _a.source_type,
                                    source_id: (_b = item.documents) === null || _b === void 0 ? void 0 : _b.source_id
                                });
                            })];
                    case 2:
                        error_2 = _b.sent();
                        console.error('検索エラー:', error_2);
                        throw new Error('検索中にエラーが発生しました');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * ドキュメントIDに基づいてチャンクを取得
     * @param documentId ドキュメントID
     * @returns チャンクの配列
     */
    RAGService.prototype.getChunksByDocumentId = function (documentId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, supabase_1.default
                                .from('chunks')
                                .select('*')
                                .eq('document_id', documentId)];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            throw error;
                        }
                        return [2 /*return*/, data || []];
                    case 2:
                        error_3 = _b.sent();
                        console.error("\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8 ".concat(documentId, " \u306E\u30C1\u30E3\u30F3\u30AF\u53D6\u5F97\u30A8\u30E9\u30FC:"), error_3);
                        throw new Error('チャンクの取得に失敗しました');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * ドキュメントIDに基づいてチャンクを削除
     * @param documentId ドキュメントID
     * @returns 削除が成功したかどうか
     */
    RAGService.prototype.deleteChunksByDocumentId = function (documentId) {
        return __awaiter(this, void 0, void 0, function () {
            var error, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, supabase_1.default
                                .from('chunks')
                                .delete()
                                .eq('document_id', documentId)];
                    case 1:
                        error = (_a.sent()).error;
                        if (error) {
                            throw error;
                        }
                        return [2 /*return*/, true];
                    case 2:
                        error_4 = _a.sent();
                        console.error("\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8 ".concat(documentId, " \u306E\u30C1\u30E3\u30F3\u30AF\u524A\u9664\u30A8\u30E9\u30FC:"), error_4);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return RAGService;
}());
// シングルトンインスタンスをエクスポート
exports.default = new RAGService();
