import { OpenClawMemory } from './memory.js';
import { MemoryFact } from './database.js';
import { LogParser } from './parser.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ReflectionConfig {
  workspacePath: string;
  minConfidenceThreshold: number;
  maxFactsPerReflection: number;
}

export class ReflectionTask {
  private memory: OpenClawMemory;
  private parser: LogParser;
  private config: ReflectionConfig;

  constructor(memory: OpenClawMemory, config: ReflectionConfig) {
    this.memory = memory;
    this.config = config;
    this.parser = new LogParser(config.workspacePath);
  }

  // 运行每日反思
  async runDailyReflection(date?: string): Promise<ReflectionResult> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    console.log(`🔄 运行 ${targetDate} 的反思任务...`);

    const result: ReflectionResult = {
      date: targetDate,
      entitiesUpdated: 0,
      opinionsRevised: 0,
      newInsights: []
    };

    // 1. 获取今日事实
    const todayFacts = await this.memory.recallByTimeRange(targetDate, targetDate);
    
    // 2. 更新实体摘要
    for (const fact of todayFacts) {
      for (const entityName of fact.entities) {
        await this.updateEntitySummary(entityName, fact);
        result.entitiesUpdated++;
      }
    }

    // 3. 检查观点演变
    const opinions = todayFacts.filter(f => f.kind === 'opinion');
    for (const opinion of opinions) {
      const revised = await this.checkOpinionEvolution(opinion);
      if (revised) result.opinionsRevised++;
    }

    // 4. 生成新的洞察
    const insights = await this.generateInsights(todayFacts);
    result.newInsights = insights;

    // 5. 更新 memory.md 核心记忆
    await this.updateCoreMemory(todayFacts);

    return result;
  }

  private async updateEntitySummary(entityName: string, newFact: MemoryFact): Promise<void> {
    const slug = entityName.toLowerCase().replace(/\s+/g, '-');
    const entityPath = join(this.config.workspacePath, 'bank', 'entities', `${slug}.md`);

    let summary = '';
    if (existsSync(entityPath)) {
      const content = readFileSync(entityPath, 'utf-8');
      const summaryMatch = content.match(/## Summary\n([\s\S]*?)(?=\n## |\n*$)/);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }
    }

    // 添加新事实到摘要（限制条目数）
    const summaryLines = summary ? summary.split('\n') : [];
    const newLine = `- ${newFact.timestamp}: ${newFact.content}`;
    
    // 去重和限制
    if (!summaryLines.some(line => line.includes(newFact.content))) {
      summaryLines.unshift(newLine);
      if (summaryLines.length > 20) {
        summaryLines.pop(); // 保留最近20条
      }
    }

    summary = summaryLines.join('\n');

    const content = `# ${entityName}\n\n## Summary\n${summary}\n\n## Last Updated\n${newFact.timestamp}\n`;
    writeFileSync(entityPath, content, 'utf-8');
  }

  private async checkOpinionEvolution(opinion: MemoryFact): Promise<boolean> {
    if (!opinion.confidence) return false;

    // 获取历史观点
    const history = await this.memory.getOpinionHistory(opinion.content);
    if (history.length === 0) return false;

    const lastOpinion = history[0];
    const confidenceChange = Math.abs(opinion.confidence - lastOpinion.confidence);

    // 如果置信度变化超过0.2，记录演变
    if (confidenceChange > 0.2) {
      console.log(`  📊 观点演变: "${opinion.content.substring(0, 50)}..."`);
      console.log(`     置信度: ${lastOpinion.confidence} → ${opinion.confidence}`);
      
      await this.memory.addOpinionHistory(
        opinion.content,
        opinion.confidence,
        opinion.timestamp,
        [opinion.id!],
        opinion.source
      );
      return true;
    }

    return false;
  }

  private async generateInsights(facts: MemoryFact[]): Promise<string[]> {
    const insights: string[] = [];

    // 简单启发式：找出重复出现的主题
    const contentWords = facts.map(f => f.content.toLowerCase()).join(' ');
    const commonPatterns = [
      { pattern: /备份|backup/g, insight: "备份策略是近期关注的重点" },
      { pattern: /技能|skill/g, insight: "正在积极扩展技能库" },
      { pattern: /更新|upgrade/g, insight: "系统更新频繁，保持最新状态" },
      { pattern: /问题|bug|错误/g, insight: "近期遇到一些问题需要解决" }
    ];

    for (const { pattern, insight } of commonPatterns) {
      const matches = contentWords.match(pattern);
      if (matches && matches.length >= 2) {
        insights.push(insight);
      }
    }

    return insights;
  }

  private async updateCoreMemory(facts: MemoryFact[]): Promise<void> {
    const memoryPath = join(this.config.workspacePath, 'memory.md');
    
    // 读取现有内容
    let content = '';
    if (existsSync(memoryPath)) {
      content = readFileSync(memoryPath, 'utf-8');
    }

    // 提取高置信度的事实（世界和观点）
    const importantFacts = facts
      .filter(f => (f.kind === 'world' || f.kind === 'opinion') && (f.confidence || 1) > 0.8)
      .slice(0, 5);

    if (importantFacts.length === 0) return;

    // 更新 Core Facts 部分
    const coreFactsSection = importantFacts
      .map(f => `- ${f.content}`)
      .join('\n');

    // 简单追加到文件末尾（实际应该解析并合并）
    const updateSection = `\n## Auto-Updated Core Facts (${new Date().toISOString().split('T')[0]})\n${coreFactsSection}\n`;
    
    writeFileSync(memoryPath, content + updateSection, 'utf-8');
  }
}

export interface ReflectionResult {
  date: string;
  entitiesUpdated: number;
  opinionsRevised: number;
  newInsights: string[];
}