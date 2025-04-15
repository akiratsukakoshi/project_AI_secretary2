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
Object.defineProperty(exports, "__esModule", { value: true });
const notion_mcp_1 = require("../src/modules/workflows/connectors/mcp/notion-mcp");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const connector = new notion_mcp_1.NotionMCPConnector('http://localhost:8000'); // ← ここが今回の鍵！
        const tools = yield connector.getAvailableTools();
        console.log('📦 MCPツール一覧:', tools.map((t) => t.name));
    });
}
main().catch(err => {
    console.error('❌ 実行中にエラー:', err);
});
