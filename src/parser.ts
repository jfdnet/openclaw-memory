import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { MemoryFact } from './database.js';

export interface ParsedLog {
  date: string;
  content: string;
  retainItems: RetainItem[];
}

export interface RetainItem {
  type: 'W' | 'B' | 'O' | 'S';
  entities: string[];
  content: string;
  confidence?: number;
}

export class LogParser {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  parseDailyLog(date: string): ParsedLog | null {
    const logPath = join(this.workspacePath, 'memory', `${date}.md`);
    
    if (!existsSync(logPath)) {
      return null;
    }

    const content = readFileSync(logPath, 'utf-8');
    const retainItems = this.parseRetainSection(content);

    return {
      date,
      content,
      retainItems
    };
  }

  private parseRetainSection(content: string): RetainItem[] {
    const retainRegex = /## Retain\n([\s\S]*?)(?=\n## |\n*$)/;
    const match = content.match(retainRegex);
    
    if (!match) return [];

    const retainContent = match[1];
    const items: RetainItem[] = [];

    // 解析每个列表项
    const lines = retainContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('-')) continue;

      const item = this.parseRetainItem(trimmed);
      if (item) items.push(item);
    }

    return items;
  }

  private parseRetainItem(line: string): RetainItem | null {
    // 格式: - B @main: Content
    // 格式: - O(c=0.9) @main: Content
    // 格式: - W @openclaw-control-center: Content
    
    // 匹配类型前缀和可选的置信度
    const prefixMatch = line.match(/^- ([WBOS])(?:\(c=([\d.]+)\))?\s+/);
    if (!prefixMatch) return null;

    const [, type, confidence] = prefixMatch;
    
    // 剩余部分匹配实体和内容
    const rest = line.slice(prefixMatch[0].length);
    const contentMatch = rest.match(/^((?:@[\w-]+\s*)+):\s*(.+)$/);
    
    if (!contentMatch) {
      // 没有实体，只有内容
      return {
        type: type as 'W' | 'B' | 'O' | 'S',
        entities: [],
        content: rest.trim(),
        confidence: confidence ? parseFloat(confidence) : undefined
      };
    }

    const [, entityStr, content] = contentMatch;
    const entities = entityStr.match(/@[\w-]+/g) || [];

    return {
      type: type as 'W' | 'B' | 'O' | 'S',
      entities: entities.map(e => e.slice(1)), // 去掉 @
      content: content.trim(),
      confidence: confidence ? parseFloat(confidence) : undefined
    };
  }

  getAllLogDates(): string[] {
    const memoryDir = join(this.workspacePath, 'memory');
    
    if (!existsSync(memoryDir)) {
      return [];
    }

    const files = readdirSync(memoryDir);
    const dates: string[] = [];

    for (const file of files) {
      const match = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
      if (match) {
        dates.push(match[1]);
      }
    }

    return dates.sort();
  }

  retainItemToFact(item: RetainItem, date: string, source: string): MemoryFact {
    const kindMap: Record<string, 'world' | 'experience' | 'opinion' | 'observation'> = {
      'W': 'world',
      'B': 'experience',
      'O': 'opinion',
      'S': 'observation'
    };

    return {
      kind: kindMap[item.type],
      content: item.content,
      timestamp: date,
      entities: item.entities,
      source,
      confidence: item.confidence
    };
  }
}