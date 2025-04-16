"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var chunker_1 = require("./chunker");
var uuid_1 = require("uuid");
var ragService_1 = require("../../services/supabase/ragService");
/**
 * ドキュメントインデクサーモジュール
 *
 * ドキュメントのインデックス化とチャンク管理を行う
 */
var Indexer = /** @class */ (function () {
    function Indexer() {
    }
    /**
     * ドキュメントをインデックス化する
     * @param document インデックス化するドキュメント
     * @returns インデックス化されたドキュメントのID
     */
    Indexer.prototype.indexDocument = function (document) {
        return __awaiter(this, void 0, void 0, function () {
            var docId, _a, data, error, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        docId = document.id || (0, uuid_1.v4)();
                        // ドキュメント情報をSupabaseに保存
                        // debug: コンソールに出力
                        console.debug('インデックス化するドキュメント:', {
                            id: docId,
                            title: document.title,
                            content: document.content.substring(0, 100) + '...',
                            source_type: document.source_type,
                            metadata: document.metadata
                        });
                        return [4 /*yield*/, supabase_1.default
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
                                .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error('ドキュメント保存エラー:', error);
                            throw error;
                        }
                        return [2 /*return*/, docId];
                    case 2:
                        error_1 = _b.sent();
                        console.error('ドキュメントのインデックス化エラー:', error_1);
                        throw new Error('ドキュメントのインデックス化に失敗しました');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * ドキュメントをチャンク分割してインデックス化する
     * @param document インデックス化するドキュメント
     * @returns チャンク数
     */
    Indexer.prototype.indexDocumentWithChunks = function (document) {
        return __awaiter(this, void 0, void 0, function () {
            var docId_1, chunks, chunksWithDocId, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.indexDocument(document)];
                    case 1:
                        docId_1 = _a.sent();
                        chunks = chunker_1.default.chunkDocument(document);
                        chunksWithDocId = chunks.map(function (chunk) { return (__assign(__assign({}, chunk), { document_id: docId_1 })); });
                        // チャンクを保存
                        return [4 /*yield*/, ragService_1.default.saveChunks(chunksWithDocId)];
                    case 2:
                        // チャンクを保存
                        _a.sent();
                        return [2 /*return*/, chunks.length];
                    case 3:
                        error_2 = _a.sent();
                        console.error('ドキュメントとチャンクのインデックス化エラー:', error_2);
                        throw new Error('ドキュメントとチャンクのインデックス化に失敗しました');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * チャンクをインデックス化する
     * @param documentId チャンクが属するドキュメントID
     * @param chunk インデックス化するチャンク
     * @returns インデックス化されたチャンクのID
     */
    Indexer.prototype.indexChunk = function (documentId, chunk) {
        return __awaiter(this, void 0, void 0, function () {
            var chunkId, _a, data, error, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        chunkId = chunk.id || (0, uuid_1.v4)();
                        // ドキュメントIDを設定
                        chunk.document_id = documentId;
                        return [4 /*yield*/, supabase_1.default
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
                                .single()];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error('チャンク保存エラー:', error);
                            throw error;
                        }
                        return [2 /*return*/, chunkId];
                    case 2:
                        error_3 = _b.sent();
                        console.error('チャンクのインデックス化エラー:', error_3);
                        throw new Error('チャンクのインデックス化に失敗しました');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return Indexer;
}());
// シングルトンインスタンスをエクスポート
exports.default = new Indexer();
