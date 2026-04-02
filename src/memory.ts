import { MemoryDatabase, MemoryFact } from './database.js';
import { LogParser } from './parser.js';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';

export interface MemoryConfig {
  workspacePath: string;
  enableReflection: boolean;
  reflectionInterval: number; // days
}

export class OpenClawMemory {
  private db: MemoryDatabase;
  private parser: LogParser;
  private config: MemoryConfig;

  constructor(config: MemoryConfig) {
    this.config = config;
    this.db = new MemoryDatabase(config.workspacePath);
    this.parser = new LogParser(config.workspacePath);
  }

  async init(): Promise<void> {
    await this.db.init();
    this.ensureDirectoryStructure();
  }

  private ensureDirectoryStructure(): void {
    const dirs = [
      join(this.config.workspacePath, 'memory'),
      join(this.config.workspacePath, 'bank'),
      join(this.config.workspacePath, 'bank', 'entities')
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // 确保 core 文件存在
    const coreFiles = [
      { path: join(this.config.workspacePath, 'memory.md'), template: '# Memory\n\n核心记忆和偏好。\n' },
      { path: join(this.config.workspacePath, 'bank', 'world.md'), template: '# World\n\n关于世界的客观事实。\n' },
      { path: join(this.config.workspacePath, 'bank', 'experience.md'), template: '# Experience\n\n经历记录。\n' },
      { path: join(this.config.workspacePath, 'bank', 'opinions.md'), template: '# Opinions\n\n主观偏好和判断。\n' }
    ];

    for (const { path, template } of coreFiles) {
      if (!existsSync(path)) {
        writeFileSync(path, template, 'utf-8');
      }
    }
  }

  async indexDailyLog(date: string): Promise<number> {
    const log = this.parser.parseDailyLog(date);
    if (!log) return 0;

    let count = 0;
    for (const item of log.retainItems) {
      const fact = this.parser.retainItemToFact(item, date, `memory/${date}.md`);
      await this.db.addFact(fact);
      count++;

      // 更新实体
      for (const entityName of item.entities) {
        await this.updateEntity(entityName, item.content, date);
      }
    }

    return count;
  }

  async indexAllLogs(): Promise<number> {
    const dates = this.parser.getAllLogDates();
    let total = 0;

    for (const date of dates) {
      const count = await this.indexDailyLog(date);
      total += count;
    }

    return total;
  }

  private async updateEntity(name: string, newFact: string, date: string): Promise<void> {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const entityPath = join(this.config.workspacePath, 'bank', 'entities', `${slug}.md`);

    let summary = '';
    if (existsSync(entityPath)) {
      const content = readFileSync(entityPath, 'utf-8');
      const summaryMatch = content.match(/## Summary\n([\s\S]*?)(?=\n## |\n*$)/);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }
    }

    // 追加新事实到摘要
    summary = summary ? `${summary}\n- ${date}: ${newFact}` : `- ${date}: ${newFact}`;

    const content = `# ${name}\n\n## Summary\n${summary}\n\n## Last Updated\n${date}\n`;
    writeFileSync(entityPath, content, 'utf-8');

    // 更新数据库
    await this.db.upsertEntity({
      name,
      slug,
      summary,
      lastUpdated: date
    });
  }

  async recall(query: string, options: { limit?: number; since?: number } = {}): Promise<MemoryFact[]> {
    const { limit = 10 } = options;
    return this.db.search(query, limit);
  }

  async recallByEntity(entity: string, limit: number = 10): Promise<MemoryFact[]> {
    return this.db.searchByEntity(entity, limit);
  }

  async getEntities(): Promise<{ name: string; slug: string; summary: string }[]> {
    return this.db.getEntities();
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}