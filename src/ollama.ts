import { EmbeddingConfig, EmbeddingService } from './embedding.js';

export interface OllamaConfig {
  baseURL: string;
  model: string;
}

export class OllamaEmbeddingService extends EmbeddingService {
  private ollamaConfig: OllamaConfig;
  private ollamaEnabled: boolean = false;

  constructor(config: OllamaConfig) {
    super({});
    this.ollamaConfig = config;
    this.ollamaEnabled = true;
  }

  isEnabled(): boolean {
    return this.ollamaEnabled;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.ollamaConfig.baseURL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.ollamaConfig.model,
        prompt: text
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json() as { embedding: number[] };
    return data.embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Ollama 不支持批量，逐个处理
    const embeddings: number[][] = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }

  // 检查 Ollama 是否可用
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaConfig.baseURL}/api/tags`, {
        method: 'GET'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // 列出可用模型
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.ollamaConfig.baseURL}/api/tags`);
      const data = await response.json() as { models?: { name: string }[] };
      return data.models?.map((m) => m.name) || [];
    } catch {
      return [];
    }
  }
}