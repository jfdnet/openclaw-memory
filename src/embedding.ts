import OpenAI from 'openai';

export interface EmbeddingConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  dimensions?: number;
}

export class EmbeddingService {
  private client: OpenAI | null = null;
  private model: string;
  private dimensions: number;
  private enabled: boolean = false;

  constructor(config: EmbeddingConfig = {}) {
    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL
      });
      this.enabled = true;
    }
    this.model = config.model || 'text-embedding-3-small';
    this.dimensions = config.dimensions || 1536;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.client) {
      throw new Error('Embedding service not configured');
    }

    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
      dimensions: this.dimensions
    });

    return response.data[0].embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      throw new Error('Embedding service not configured');
    }

    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
      dimensions: this.dimensions
    });

    return response.data.map(d => d.embedding);
  }

  // 计算余弦相似度
  cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 找到最相似的向量
  findMostSimilar(query: number[], candidates: number[][], topK: number = 5): { index: number; similarity: number }[] {
    const similarities = candidates.map((candidate, index) => ({
      index,
      similarity: this.cosineSimilarity(query, candidate)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}