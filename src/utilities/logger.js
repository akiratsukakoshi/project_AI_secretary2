"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
const env_1 = require("../config/env");
// 簡易的なロガーの実装
// 将来的にはWinstonなどのライブラリに置き換える予定
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 4] = "TRACE";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        this.level = this.parseLogLevel(env_1.env.LOG_LEVEL || 'info');
    }
    parseLogLevel(level) {
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
    }
    formatMessage(level, message, ...meta) {
        const timestamp = new Date().toISOString();
        const metaStr = meta.length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] ${message}${metaStr}`;
    }
    error(message, ...meta) {
        if (this.level >= LogLevel.ERROR) {
            console.error(this.formatMessage('ERROR', message, ...meta));
        }
    }
    warn(message, ...meta) {
        if (this.level >= LogLevel.WARN) {
            console.warn(this.formatMessage('WARN', message, ...meta));
        }
    }
    info(message, ...meta) {
        if (this.level >= LogLevel.INFO) {
            console.info(this.formatMessage('INFO', message, ...meta));
        }
    }
    debug(message, ...meta) {
        if (this.level >= LogLevel.DEBUG) {
            console.debug(this.formatMessage('DEBUG', message, ...meta));
        }
    }
    trace(message, ...meta) {
        if (this.level >= LogLevel.TRACE) {
            console.log(this.formatMessage('TRACE', message, ...meta));
        }
    }
}
exports.default = new Logger();
