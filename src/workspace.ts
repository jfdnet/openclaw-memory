import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface Workspace {
  name: string;
  path: string;
  description?: string;
  createdAt: string;
  lastUsed: string;
}

export class WorkspaceManager {
  private configDir: string;
  private configFile: string;
  private workspaces: Map<string, Workspace> = new Map();

  constructor() {
    this.configDir = join(homedir(), '.openclaw-mem-recall');
    this.configFile = join(this.configDir, 'workspaces.json');
    this.load();
  }

  private load(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    if (existsSync(this.configFile)) {
      try {
        const data = JSON.parse(readFileSync(this.configFile, 'utf-8'));
        for (const [name, workspace] of Object.entries(data)) {
          this.workspaces.set(name, workspace as Workspace);
        }
      } catch {
        // 忽略错误
      }
    }

    // 确保默认工作区存在
    if (!this.workspaces.has('default')) {
      this.add('default', join(homedir(), '.openclaw', 'workspace'), '默认工作区');
    }
  }

  private save(): void {
    const data: Record<string, Workspace> = {};
    for (const [name, workspace] of this.workspaces) {
      data[name] = workspace;
    }
    writeFileSync(this.configFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  add(name: string, path: string, description?: string): void {
    if (this.workspaces.has(name)) {
      throw new Error(`Workspace "${name}" already exists`);
    }

    const now = new Date().toISOString();
    this.workspaces.set(name, {
      name,
      path,
      description,
      createdAt: now,
      lastUsed: now
    });

    this.save();
  }

  remove(name: string): void {
    if (!this.workspaces.has(name)) {
      throw new Error(`Workspace "${name}" not found`);
    }

    this.workspaces.delete(name);
    this.save();
  }

  get(name: string): Workspace | undefined {
    return this.workspaces.get(name);
  }

  list(): Workspace[] {
    return Array.from(this.workspaces.values())
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
  }

  use(name: string): Workspace {
    const workspace = this.workspaces.get(name);
    if (!workspace) {
      throw new Error(`Workspace "${name}" not found`);
    }

    workspace.lastUsed = new Date().toISOString();
    this.save();
    return workspace;
  }

  setCurrent(name: string): void {
    const currentFile = join(this.configDir, 'current');
    writeFileSync(currentFile, name, 'utf-8');
  }

  getCurrent(): string {
    const currentFile = join(this.configDir, 'current');
    if (existsSync(currentFile)) {
      return readFileSync(currentFile, 'utf-8').trim();
    }
    return 'default';
  }

  getCurrentWorkspace(): Workspace {
    return this.use(this.getCurrent());
  }
}