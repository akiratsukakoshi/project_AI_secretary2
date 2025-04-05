export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string; // functionロールの場合に使用
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface EmbeddingOptions {
  model: string;
  input: string | string[];
  dimensions?: number;
}

export interface EmbeddingVector {
  embedding: number[];
  index: number;
  object: string;
}

export interface EmbeddingResponse {
  data: EmbeddingVector[];
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}