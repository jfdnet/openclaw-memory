import sqlite3 from 'sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface MemoryFact {
  id?: number;
  kind: 'world' | 'experience' | 'opinion' | 'observation';
  content: string;
  timestamp: string;
  entities: string[];
  source: string;
  confidence?: number;
}

export interface Entity {
  id?: number;
  name: string;
  slug: string;
  summary: string;
  lastUpdated: string;
}

export class MemoryDatabase {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(workspacePath: string) {
    const memoryDir = join(workspacePath, '.memory');
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
    }
    this.dbPath = join(memoryDir, 'index.sqlite');
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          this.createTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const exec = (sql: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        this.db!.exec(sql, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };

    // 事实表
    await exec(`
      CREATE TABLE IF NOT EXISTS facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        entities TEXT,
        source TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // FTS5 虚拟表
    await exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
        content,
        content_rowid=rowid
      )
    `);

    // 实体表
    await exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        summary TEXT,
        last_updated TEXT NOT NULL
      )
    `);

    // 触发器
    await exec(`
      CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
        INSERT INTO facts_fts(rowid, content) VALUES (new.id, new.content);
      END
    `);

    await exec(`
      CREATE TRIGGER IF NOT EXISTS facts_ad AFTER DELETE ON facts BEGIN
        INSERT INTO facts_fts(facts_fts, rowid, content) VALUES ('delete', old.id, old.content);
      END
    `);
  }

  async addFact(fact: MemoryFact): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO facts (kind, content, timestamp, entities, source, confidence)
         VALUES (?, ?, ?, ?, ?, ?)`,
        fact.kind,
        fact.content,
        fact.timestamp,
        JSON.stringify(fact.entities),
        fact.source,
        fact.confidence ?? 1.0,
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve(this.lastID!);
        }
      );
    });
  }

  async search(query: string, limit: number = 10): Promise<MemoryFact[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT f.* FROM facts f
         JOIN facts_fts fts ON f.id = fts.rowid
         WHERE facts_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
        query,
        limit,
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else {
            resolve(rows.map(row => ({
              ...row,
              entities: JSON.parse(row.entities || '[]')
            })));
          }
        }
      );
    });
  }

  async searchByEntity(entity: string, limit: number = 10): Promise<MemoryFact[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        `SELECT * FROM facts
         WHERE entities LIKE ?
         ORDER BY timestamp DESC
         LIMIT ?`,
        `%${entity}%`,
        limit,
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else {
            resolve(rows.map(row => ({
              ...row,
              entities: JSON.parse(row.entities || '[]')
            })));
          }
        }
      );
    });
  }

  async getEntities(): Promise<Entity[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM entities ORDER BY name',
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else {
            resolve(rows.map(row => ({
              id: row.id,
              name: row.name,
              slug: row.slug,
              summary: row.summary,
              lastUpdated: row.last_updated
            })));
          }
        }
      );
    });
  }

  async upsertEntity(entity: Entity): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO entities (name, slug, summary, last_updated)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name,
         summary = excluded.summary,
         last_updated = excluded.last_updated`,
        entity.name,
        entity.slug,
        entity.summary,
        entity.lastUpdated,
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err: Error | null) => {
          if (err) reject(err);
          else {
            this.db = null;
            resolve();
          }
        });
      });
    }
  }
}