import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryDatabase } from '../src/database.js';
import { LogParser } from '../src/parser.js';
import { LogWriter } from '../src/logwriter.js';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('MemoryDatabase', () => {
  let db: MemoryDatabase;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'openclaw-memory-test-'));
    db = new MemoryDatabase(tempDir);
  });

  afterEach(async () => {
    await db.close();
    rmSync(tempDir, { recursive: true });
  });

  it('should initialize database', async () => {
    await db.init();
    expect(existsSync(join(tempDir, '.memory', 'index.sqlite'))).toBe(true);
  });

  it('should add and retrieve facts', async () => {
    await db.init();
    
    const factId = await db.addFact({
      kind: 'experience',
      content: 'Test fact',
      timestamp: '2026-04-02',
      entities: ['test'],
      source: 'test.md',
      confidence: 0.9
    });

    expect(factId).toBeGreaterThan(0);
  });

  it('should search facts by query', async () => {
    await db.init();
    
    await db.addFact({
      kind: 'world',
      content: 'OpenClaw is a great tool',
      timestamp: '2026-04-02',
      entities: ['openclaw'],
      source: 'test.md'
    });

    const results = await db.search('OpenClaw');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('OpenClaw');
  });
});

describe('LogParser', () => {
  let parser: LogParser;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'openclaw-memory-test-'));
    parser = new LogParser(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true });
  });

  it('should parse retain items correctly', () => {
    const testContent = `## Retain
- B @main: Updated OpenClaw to 2026.4.1
- W @test: Test world fact
- O(c=0.9) @main: Prefers concise replies`;

    // 创建测试文件
    const memoryDir = join(tempDir, 'memory');
    const fs = require('fs');
    fs.mkdirSync(memoryDir, { recursive: true });
    fs.writeFileSync(join(memoryDir, '2026-04-02.md'), testContent);

    const log = parser.parseDailyLog('2026-04-02');
    expect(log).not.toBeNull();
    expect(log!.retainItems.length).toBe(3);
    expect(log!.retainItems[0].type).toBe('B');
    expect(log!.retainItems[2].confidence).toBe(0.9);
  });
});

describe('LogWriter', () => {
  let writer: LogWriter;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'openclaw-memory-test-'));
    const fs = require('fs');
    fs.mkdirSync(join(tempDir, 'memory'), { recursive: true });
    writer = new LogWriter(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true });
  });

  it('should write log entry to new file', async () => {
    const entry = {
      type: 'B' as const,
      entities: ['main'],
      content: 'Test log entry',
      confidence: 0.95
    };

    const logPath = await writer.log(entry, '2026-04-02');
    expect(existsSync(logPath)).toBe(true);
    
    const content = readFileSync(logPath, 'utf-8');
    expect(content).toContain('Test log entry');
    expect(content).toContain('@main');
  });

  it('should append to existing file', async () => {
    const fs = require('fs');
    const existingContent = `# 2026-04-02\n\n## Retain\n- B @main: First entry\n`;
    fs.writeFileSync(join(tempDir, 'memory', '2026-04-02.md'), existingContent);

    const entry = {
      type: 'W' as const,
      entities: ['test'],
      content: 'Second entry'
    };

    await writer.log(entry, '2026-04-02');
    
    const content = readFileSync(join(tempDir, 'memory', '2026-04-02.md'), 'utf-8');
    expect(content).toContain('First entry');
    expect(content).toContain('Second entry');
  });
});