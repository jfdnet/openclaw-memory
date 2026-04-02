import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface LogEntry {
  type: 'W' | 'B' | 'O' | 'S';
  entities: string[];
  content: string;
  confidence?: number;
}

export class LogWriter {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  // 快速记录一条记忆
  async log(entry: LogEntry, date?: string): Promise<string> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const logPath = join(this.workspacePath, 'memory', `${targetDate}.md`);

    // 确保目录存在
    const memoryDir = join(this.workspacePath, 'memory');
    if (!existsSync(memoryDir)) {
      throw new Error('Memory directory not found. Run `openclaw-memory init` first.');
    }

    // 构建日志条目
    const entityStr = entry.entities.map(e => `@${e}`).join(' ');
    const confidenceStr = entry.confidence ? `(c=${entry.confidence})` : '';
    const logLine = `- ${entry.type}${confidenceStr} ${entityStr}: ${entry.content}`;

    // 检查文件是否存在
    if (existsSync(logPath)) {
      // 追加到 Retain 部分或创建新部分
      const content = readFileSync(logPath, 'utf-8');
      
      if (content.includes('## Retain')) {
        // 在 Retain 部分追加，确保前面有换行
        const needsNewline = content.endsWith('\n') ? '' : '\n';
        const updated = content.replace(
          /(## Retain\n)([\s\S]*?)(?=\n## |\n*$)/,
          (match, header, existing) => {
            const trimmed = existing.trimEnd();
            return `${header}${trimmed}${needsNewline}${logLine}\n`;
          }
        );
        writeFileSync(logPath, updated, 'utf-8');
      } else {
        // 添加 Retain 部分
        appendFileSync(logPath, `\n## Retain\n${logLine}\n`, 'utf-8');
      }
    } else {
      // 创建新文件
      const header = `# ${targetDate}\n\n## Retain\n${logLine}\n`;
      writeFileSync(logPath, header, 'utf-8');
    }

    return logPath;
  }

  // 交互式记录
  async logInteractive(): Promise<LogEntry> {
    // 这里会在 CLI 中实现交互式提示
    throw new Error('Interactive mode not implemented in core');
  }
}