import chunker from './chunker';
import indexer from './indexer';
import retriever from './retriever';
import promptBuilder from './promptBuilder';

export {
  chunker,
  indexer,
  retriever,
  promptBuilder
};

/**
 * RAGシステムのメインモジュール
 * これを使用してRAG関連の機能にアクセスします
 */
const RAG = {
  /**
   * ドキュメントをチャンクに分割
   */
  chunker,
  
  /**
   * ドキュメントをインデックス化（チャンク分割、埋め込み生成、保存）
   */
  indexer,
  
  /**
   * ベクトル検索を実行
   */
  retriever,
  
  /**
   * 検索結果を使用してプロンプトを構築
   */
  promptBuilder
};

export default RAG;
