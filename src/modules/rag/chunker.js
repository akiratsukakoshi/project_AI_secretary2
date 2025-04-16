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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ドキュメントチャンキングモジュール
 * 様々なタイプのドキュメントを適切な方法でチャンク分割する
 */
var Chunker = /** @class */ (function () {
    function Chunker() {
    }
    /**
     * ドキュメントをチャンク分割する
     */
    Chunker.prototype.chunkDocument = function (document, options) {
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
    };
    /**
     * デフォルトのチャンク分割
     */
    Chunker.prototype.defaultChunking = function (document, options) {
        var content = document.content;
        var chunkSize = (options === null || options === void 0 ? void 0 : options.chunkSize) || 1000;
        // 段落で分割する基本的な処理
        var paragraphs = content.split(/\n\n+/);
        var chunks = [];
        var currentChunk = '';
        for (var _i = 0, paragraphs_1 = paragraphs; _i < paragraphs_1.length; _i++) {
            var para = paragraphs_1[_i];
            // チャンクサイズを超えそうなら新しいチャンクを開始
            if (currentChunk.length + para.length + 2 > chunkSize) {
                chunks.push({
                    document_id: document.id || '',
                    content: currentChunk,
                    metadata: __assign({}, document.metadata)
                });
                currentChunk = para;
            }
            else {
                // 現在のチャンクに段落を追加
                currentChunk = currentChunk ? "".concat(currentChunk, "\n\n").concat(para) : para;
            }
        }
        // 最後のチャンクを追加
        if (currentChunk) {
            chunks.push({
                document_id: document.id || '',
                content: currentChunk,
                metadata: __assign({}, document.metadata)
            });
        }
        return chunks;
    };
    /**
     * FAQ形式のドキュメントをチャンク分割
     */
    Chunker.prototype.chunkFAQ = function (document, options) {
        // 見出しを使用した基本的な分割
        var content = document.content;
        var sections = content.split(/(?=#{1,3}\s+)/);
        return sections.map(function (section) { return ({
            document_id: document.id || '',
            content: section,
            metadata: __assign(__assign({}, document.metadata), { type: 'faq', has_heading: section.startsWith('#') })
        }); });
    };
    /**
     * イベント情報のチャンク分割
     */
    Chunker.prototype.chunkEvent = function (document, options) {
        // イベントはそのまま1チャンクとして扱う
        return [{
                document_id: document.id || '',
                content: document.content,
                metadata: __assign(__assign({}, document.metadata), { type: 'event' })
            }];
    };
    /**
     * 顧客情報のチャンク分割
     */
    Chunker.prototype.chunkCustomer = function (document, options) {
        // 顧客情報もそのまま1チャンクとして扱う
        return [{
                document_id: document.id || '',
                content: document.content,
                metadata: __assign(__assign({}, document.metadata), { type: 'customer' })
            }];
    };
    /**
     * 議事録のチャンク分割
     */
    Chunker.prototype.chunkMeetingNote = function (document, options) {
        // 見出しを使用した基本的な分割
        var content = document.content;
        var sections = content.split(/(?=#{1,3}\s+)/);
        return sections.map(function (section) { return ({
            document_id: document.id || '',
            content: section,
            metadata: __assign(__assign({}, document.metadata), { type: 'meeting_note', has_heading: section.startsWith('#') })
        }); });
    };
    /**
     * システム情報のチャンク分割
     */
    Chunker.prototype.chunkSystemInfo = function (document, options) {
        // 見出しを使用した基本的な分割
        var content = document.content;
        var sections = content.split(/(?=#{1,3}\s+)/);
        return sections.map(function (section) { return ({
            document_id: document.id || '',
            content: section,
            metadata: __assign(__assign({}, document.metadata), { type: 'system_info', has_heading: section.startsWith('#') })
        }); });
    };
    /**
     * Q&Aパターンでチャンク分割（シンプル実装）
     */
    Chunker.prototype.chunkByQA = function (document, options) {
        var content = document.content;
        // Q&Aパターンで分割
        var qaPairs = content.split(/(?=Q[:：])/i).filter(Boolean);
        return qaPairs.map(function (qaPair) { return ({
            document_id: document.id || '',
            content: qaPair,
            metadata: __assign(__assign({}, document.metadata), { type: 'faq', is_qa_pair: true })
        }); });
    };
    /**
     * 見出しでチャンク分割（シンプル実装）
     */
    Chunker.prototype.chunkByHeadings = function (document, options) {
        var content = document.content;
        var sections = content.split(/(?=#{1,3}\s+)/);
        return sections.map(function (section) { return ({
            document_id: document.id || '',
            content: section,
            metadata: __assign(__assign({}, document.metadata), { has_heading: section.startsWith('#') })
        }); });
    };
    return Chunker;
}());
// シングルトンインスタンスをエクスポート
exports.default = new Chunker();
