"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
var env_1 = require("../config/env");
var fs = require("fs");
var path = require("path");
// 拡張ロガーの実装
// シングルトンパターンでアプリケーション全体で共有
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 4] = "TRACE";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
// タイムスタンプ付きのファイル名を生成するヘルパー関数
var getTimestampedFilename = function (baseFilename) {
    var now = new Date();
    var datePart = "".concat(now.getFullYear(), "-").concat(String(now.getMonth() + 1).padStart(2, '0'), "-").concat(String(now.getDate()).padStart(2, '0'));
    return "".concat(baseFilename, "-").concat(datePart, ".log");
};
var Logger = /** @class */ (function () {
    function Logger() {
        var _this = this;
        this.maxLogFileSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 5; // 保持するログファイル数
        this.logDirectory = path.resolve(process.cwd(), 'logs');
        // エラーカウント（統計用）
        this.errorCount = new Map();
        // 前回のエラーメッセージ（重複防止用）
        this.lastErrorMessage = '';
        this.lastErrorTime = 0;
        this.duplicateThreshold = 1000; // 同一エラーの繰り返し間隔（ミリ秒）
        this.level = this.parseLogLevel(env_1.env.LOG_LEVEL || 'info');
        // カスタム設定の適用
        if (env_1.env.LOG_MAX_SIZE) {
            // 文字列をパースして数値に変換
            this.maxLogFileSize = parseInt(env_1.env.LOG_MAX_SIZE) * 1024 * 1024; // MB単位
        }
        if (env_1.env.LOG_MAX_FILES) {
            // 文字列をパースして数値に変換
            this.maxLogFiles = parseInt(env_1.env.LOG_MAX_FILES);
        }
        if (env_1.env.LOG_DIRECTORY) {
            // 文字列パスでリゾルブ
            this.logDirectory = path.resolve(process.cwd(), env_1.env.LOG_DIRECTORY);
        }
        // ログディレクトリの作成
        this.ensureLogDirectory();
        // ログファイルパスの設定
        this.errorLogPath = path.join(this.logDirectory, getTimestampedFilename('error'));
        this.combinedLogPath = path.join(this.logDirectory, getTimestampedFilename('combined'));
        // プロセス終了時の統計出力
        process.on('exit', function () {
            _this.outputErrorStats();
        });
    }
    Logger.prototype.ensureLogDirectory = function () {
        try {
            if (!fs.existsSync(this.logDirectory)) {
                fs.mkdirSync(this.logDirectory, { recursive: true });
            }
        }
        catch (error) {
            console.error("\u30ED\u30B0\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ".concat(error instanceof Error ? error.message : String(error)));
        }
    };
    Logger.prototype.parseLogLevel = function (level) {
        switch (level.toLowerCase()) {
            case 'error':
                return LogLevel.ERROR;
            case 'warn':
                return LogLevel.WARN;
            case 'info':
                return LogLevel.INFO;
            case 'debug':
                return LogLevel.DEBUG;
            case 'trace':
                return LogLevel.TRACE;
            default:
                return LogLevel.INFO;
        }
    };
    Logger.prototype.formatMessage = function (level, message) {
        var meta = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            meta[_i - 2] = arguments[_i];
        }
        var timestamp = new Date().toISOString();
        var metaStr = '';
        // メタデータの整形（読みやすさ向上）
        if (meta.length > 0) {
            try {
                metaStr = " ".concat(JSON.stringify(meta, this.circularReplacer(), 2));
            }
            catch (e) {
                // JSON変換エラー時の代替処理
                metaStr = " [Meta conversion error: ".concat(e instanceof Error ? e.message : String(e), "]");
            }
        }
        return "[".concat(timestamp, "] [").concat(level, "] ").concat(message).concat(metaStr);
    };
    // 循環参照対応のJSON変換ヘルパー
    Logger.prototype.circularReplacer = function () {
        var seen = new WeakSet();
        return function (key, value) {
            // 無視すべきプロパティをスキップ
            if (key === 'password' || key === 'token' || key === 'secret') {
                return '[REDACTED]';
            }
            // 循環参照の検出と処理
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular Reference]';
                }
                seen.add(value);
            }
            // 長すぎる配列や文字列の省略
            if (Array.isArray(value) && value.length > 50) {
                return "[Array(".concat(value.length, ") - truncated]");
            }
            if (typeof value === 'string' && value.length > 1000) {
                return value.substring(0, 1000) + '... [truncated]';
            }
            return value;
        };
    };
    // ファイルへのログ書き込み
    Logger.prototype.writeToFile = function (filePath, message) {
        try {
            // ファイルが存在しなければ作成
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, '');
            }
            // ファイルサイズをチェック
            var stats = fs.statSync(filePath);
            if (stats.size > this.maxLogFileSize) {
                this.rotateLogFile(filePath);
            }
            // ログを追記
            fs.appendFileSync(filePath, message + '\n');
        }
        catch (error) {
            console.error("\u30ED\u30B0\u30D5\u30A1\u30A4\u30EB\u3078\u306E\u66F8\u304D\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ".concat(error instanceof Error ? error.message : String(error)));
        }
    };
    // ログローテーション
    Logger.prototype.rotateLogFile = function (filePath) {
        try {
            var baseName = path.basename(filePath);
            var dirName_1 = path.dirname(filePath);
            var baseNameWithoutDate_1 = baseName.split('-')[0];
            // 既存のログファイルを検索して日付でソート
            var files = fs.readdirSync(dirName_1)
                .filter(function (file) { return file.startsWith(baseNameWithoutDate_1); })
                .sort(function (a, b) { return fs.statSync(path.join(dirName_1, b)).mtime.getTime() -
                fs.statSync(path.join(dirName_1, a)).mtime.getTime(); });
            // 古いファイルの削除
            while (files.length >= this.maxLogFiles) {
                var oldFile = files.pop();
                if (oldFile) {
                    fs.unlinkSync(path.join(dirName_1, oldFile));
                }
            }
            // 新しいファイルパスを生成
            var newFilePath = path.join(dirName_1, getTimestampedFilename(baseNameWithoutDate_1));
            // ファイル名を変更
            if (filePath === this.errorLogPath) {
                this.errorLogPath = newFilePath;
            }
            else if (filePath === this.combinedLogPath) {
                this.combinedLogPath = newFilePath;
            }
        }
        catch (error) {
            console.error("\u30ED\u30B0\u30ED\u30FC\u30C6\u30FC\u30B7\u30E7\u30F3\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ".concat(error instanceof Error ? error.message : String(error)));
        }
    };
    // エラーの種類ごとの統計を出力
    Logger.prototype.outputErrorStats = function () {
        if (this.errorCount.size === 0)
            return;
        var statsMessage = "\n[".concat(new Date().toISOString(), "] [INFO] \u30A8\u30E9\u30FC\u7D71\u8A08:\n") +
            Array.from(this.errorCount.entries())
                .map(function (_a) {
                var type = _a[0], count = _a[1];
                return "- ".concat(type, ": ").concat(count, "\u4EF6");
            })
                .join('\n');
        console.info(statsMessage);
        this.writeToFile(this.errorLogPath, statsMessage);
    };
    // エラータイプを抽出（エラー統計用）
    Logger.prototype.getErrorType = function (message, meta) {
        // 既知のエラーパターンを検出
        if (message.includes('関数呼び出し') || message.includes('function')) {
            return 'FunctionCallPattern';
        }
        if (message.includes('パース') || message.includes('parse')) {
            return 'JSONParseError';
        }
        if (message.includes('データベースID') || message.includes('taskDbId')) {
            return 'DatabaseIDError';
        }
        if (message.includes('サニタイズ') || message.includes('sanitize')) {
            return 'SanitizationError';
        }
        // メタデータからエラー名を検出
        if (meta && meta.length > 0) {
            var firstMeta = meta[0];
            if (typeof firstMeta === 'object' && firstMeta !== null) {
                if (firstMeta.errorName)
                    return firstMeta.errorName;
                if (firstMeta.name)
                    return firstMeta.name;
                if (firstMeta.error && typeof firstMeta.error === 'string') {
                    if (firstMeta.error.includes('taskDbId'))
                        return 'TaskDbIdError';
                    if (firstMeta.error.includes('timeout'))
                        return 'TimeoutError';
                }
            }
        }
        return 'OtherError';
    };
    // 重複エラーチェック（短時間での同一エラーの繰り返しを防止）
    Logger.prototype.isDuplicateError = function (message) {
        var now = Date.now();
        if (message === this.lastErrorMessage &&
            (now - this.lastErrorTime) < this.duplicateThreshold) {
            return true;
        }
        this.lastErrorMessage = message;
        this.lastErrorTime = now;
        return false;
    };
    Logger.prototype.error = function (message) {
        var meta = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            meta[_i - 1] = arguments[_i];
        }
        if (this.level >= LogLevel.ERROR) {
            // 重複エラーチェック
            if (this.isDuplicateError(message))
                return;
            // エラータイプの追跡
            var errorType = this.getErrorType(message, meta);
            this.errorCount.set(errorType, (this.errorCount.get(errorType) || 0) + 1);
            // フォーマットしたメッセージ
            var formattedMessage = this.formatMessage.apply(this, __spreadArray(['ERROR', message], meta, false));
            // コンソールとファイルに出力
            console.error(formattedMessage);
            this.writeToFile(this.errorLogPath, formattedMessage);
            this.writeToFile(this.combinedLogPath, formattedMessage);
            // スタックトレース情報の追加（デバッグに有用）
            var stackTrace = new Error().stack;
            if (stackTrace) {
                var stackMessage = "[".concat(new Date().toISOString(), "] [STACK] ").concat(stackTrace);
                this.writeToFile(this.errorLogPath, stackMessage);
            }
        }
    };
    Logger.prototype.warn = function (message) {
        var meta = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            meta[_i - 1] = arguments[_i];
        }
        if (this.level >= LogLevel.WARN) {
            var formattedMessage = this.formatMessage.apply(this, __spreadArray(['WARN', message], meta, false));
            console.warn(formattedMessage);
            this.writeToFile(this.combinedLogPath, formattedMessage);
        }
    };
    Logger.prototype.info = function (message) {
        var meta = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            meta[_i - 1] = arguments[_i];
        }
        if (this.level >= LogLevel.INFO) {
            var formattedMessage = this.formatMessage.apply(this, __spreadArray(['INFO', message], meta, false));
            console.info(formattedMessage);
            this.writeToFile(this.combinedLogPath, formattedMessage);
        }
    };
    Logger.prototype.debug = function (message) {
        var meta = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            meta[_i - 1] = arguments[_i];
        }
        if (this.level >= LogLevel.DEBUG) {
            var formattedMessage = this.formatMessage.apply(this, __spreadArray(['DEBUG', message], meta, false));
            console.debug(formattedMessage);
            // デバッグレベルのログはファイル容量節約のため記録しない
            // 設定がある場合のみファイルに書き込み
            if (env_1.env.LOG_DEBUG_TO_FILE === 'true') {
                this.writeToFile(this.combinedLogPath, formattedMessage);
            }
        }
    };
    Logger.prototype.trace = function (message) {
        var meta = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            meta[_i - 1] = arguments[_i];
        }
        if (this.level >= LogLevel.TRACE) {
            var formattedMessage = this.formatMessage.apply(this, __spreadArray(['TRACE', message], meta, false));
            console.log(formattedMessage);
            // トレースレベルのログはファイル容量節約のため記録しない
            // 設定がある場合のみファイルに書き込み
            if (env_1.env.LOG_TRACE_TO_FILE === 'true') {
                this.writeToFile(this.combinedLogPath, formattedMessage);
            }
        }
    };
    return Logger;
}());
exports.default = new Logger();
