import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface Config {
  workspacePath: string;
  enableReflection: boolean;
  reflectionInterval: number; // days
  enableEmbedding: boolean;
  embeddingProvider?: 'openai' | 'ollama';
  embeddingApiKey?: string;
  embeddingBaseURL?: string;
  embeddingModel?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  backupEnabled: boolean;
  backupInterval: number; // days
  backupLocation?: string;
}

export const DEFAULT_CONFIG: Config = {
  workspacePath: join(homedir(), '.openclaw', 'workspace'),
  enableReflection: true,
  reflectionInterval: 1,
  enableEmbedding: false,
  embeddingModel: 'text-embedding-3-small',
  logLevel: 'info',
  backupEnabled: true,
  backupInterval: 7
};

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor() {
    this.configPath = join(homedir(), '.openclaw-mem-recall.json');
    this.config = this.load();
  }

  private load(): Config {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        const userConfig = JSON.parse(content);
        return { ...DEFAULT_CONFIG, ...userConfig };
      } catch (error) {
        console.warn('Failed to load config, using defaults');
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  }

  save(): void {
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  get(): Config {
    return this.config;
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
    this.save();
  }

  update(partial: Partial<Config>): void {
    this.config = { ...this.config, ...partial };
    this.save();
  }

  reset(): void {
    this.config = DEFAULT_CONFIG;
    this.save();
  }

  getConfigPath(): string {
    return this.configPath;
  }
}