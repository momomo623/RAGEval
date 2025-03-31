export interface TextChunk {
  id: string;
  content: string;
  tokens: number; // 可以考虑重命名为charCount，或添加注释说明这实际是字符数
  selected: boolean;
}

export interface GenerationParams {
  count: number; // 每个块生成的问答对数量
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionTypes: ('factoid' | 'conceptual' | 'procedural' | 'comparative')[];
  maxTokens?: number; // 回答的最大token数
  concurrency?: number; // 添加并发数字段
}

export interface GeneratedQA {
  id: string;
  question: string;
  answer: string;
  difficulty: string;
  category: string;
  sourceChunkId: string;
  sourceFileName: string;
}

export interface ProgressInfo {
  totalChunks: number;
  completedChunks: number;
  totalQAPairs: number;
  generatedQAPairs: number;
  currentChunk?: TextChunk;
  error?: string;
  isCompleted: boolean;
}

export interface GenerationResult {
  qaPairs: GeneratedQA[];
  progress: ProgressInfo;
}

export interface PromptTemplate {
  name: string;
  template: string;
  description: string;
}

export interface LLMRequestPayload {
  model: string;
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  temperature: number;
  max_tokens: number;
} 