"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_1 = require("@supabase/supabase-js");
var dotenv = require("dotenv");
// 環境変数をロード
dotenv.config();
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_KEY;
// 環境変数のチェック
if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase環境変数が設定されていません');
}
// Supabaseクライアントを作成
var supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
exports.default = supabase;
