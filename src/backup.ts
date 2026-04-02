import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { MemoryDatabase } from './database.js';

export interface BackupOptions {
  workspacePath: string;
  backupDir: string;
  compress?: boolean;
}

export class BackupManager {
  private options: BackupOptions;

  constructor(options: BackupOptions) {
    this.options = {
      compress: true,
      ...options
    };
  }

  // 创建备份
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `openclaw-mem-recall-backup-${timestamp}`;
    const backupPath = join(this.options.backupDir, backupName);

    // 确保备份目录存在
    if (!existsSync(this.options.backupDir)) {
      mkdirSync(this.options.backupDir, { recursive: true });
    }

    mkdirSync(backupPath, { recursive: true });

    // 1. 备份数据库
    const dbSource = join(this.options.workspacePath, '.memory', 'index.sqlite');
    const dbTarget = join(backupPath, 'index.sqlite');
    
    if (existsSync(dbSource)) {
      await this.copyFile(dbSource, dbTarget);
    }

    // 2. 备份 Markdown 文件
    const memorySource = join(this.options.workspacePath, 'memory');
    const memoryTarget = join(backupPath, 'memory');
    
    if (existsSync(memorySource)) {
      mkdirSync(memoryTarget, { recursive: true });
      await this.copyDirectory(memorySource, memoryTarget);
    }

    // 3. 备份 bank 目录
    const bankSource = join(this.options.workspacePath, 'bank');
    const bankTarget = join(backupPath, 'bank');
    
    if (existsSync(bankSource)) {
      mkdirSync(bankTarget, { recursive: true });
      await this.copyDirectory(bankSource, bankTarget);
    }

    // 4. 备份 core 文件
    const coreFiles = ['memory.md', 'SOUL.md', 'IDENTITY.md', 'TOOLS.md'];
    for (const file of coreFiles) {
      const source = join(this.options.workspacePath, file);
      const target = join(backupPath, file);
      if (existsSync(source)) {
        await this.copyFile(source, target);
      }
    }

    // 5. 压缩（可选）
    if (this.options.compress) {
      const tarGzPath = `${backupPath}.tar.gz`;
      await this.compressDirectory(backupPath, tarGzPath);
      
      // 删除未压缩的目录
      await this.removeDirectory(backupPath);
      
      return tarGzPath;
    }

    return backupPath;
  }

  // 恢复备份
  async restoreBackup(backupPath: string): Promise<void> {
    let restoreDir = backupPath;

    // 如果是压缩文件，先解压
    if (backupPath.endsWith('.tar.gz')) {
      restoreDir = backupPath.replace('.tar.gz', '');
      await this.decompressArchive(backupPath, restoreDir);
    }

    // 1. 恢复数据库
    const dbSource = join(restoreDir, 'index.sqlite');
    const dbTarget = join(this.options.workspacePath, '.memory', 'index.sqlite');
    
    if (existsSync(dbSource)) {
      mkdirSync(join(this.options.workspacePath, '.memory'), { recursive: true });
      await this.copyFile(dbSource, dbTarget);
    }

    // 2. 恢复 Markdown 文件
    const memorySource = join(restoreDir, 'memory');
    const memoryTarget = join(this.options.workspacePath, 'memory');
    
    if (existsSync(memorySource)) {
      await this.copyDirectory(memorySource, memoryTarget);
    }

    // 3. 恢复 bank 目录
    const bankSource = join(restoreDir, 'bank');
    const bankTarget = join(this.options.workspacePath, 'bank');
    
    if (existsSync(bankSource)) {
      await this.copyDirectory(bankSource, bankTarget);
    }

    // 4. 恢复 core 文件
    const coreFiles = ['memory.md', 'SOUL.md', 'IDENTITY.md', 'TOOLS.md'];
    for (const file of coreFiles) {
      const source = join(restoreDir, file);
      const target = join(this.options.workspacePath, file);
      if (existsSync(source)) {
        await this.copyFile(source, target);
      }
    }

    // 清理临时解压目录
    if (restoreDir !== backupPath && existsSync(restoreDir)) {
      await this.removeDirectory(restoreDir);
    }
  }

  // 列出所有备份
  listBackups(): { name: string; path: string; size: number; date: Date }[] {
    if (!existsSync(this.options.backupDir)) {
      return [];
    }

    const items = readdirSync(this.options.backupDir);
    const backups: { name: string; path: string; size: number; date: Date }[] = [];

    for (const item of items) {
      const fullPath = join(this.options.backupDir, item);
      const stat = statSync(fullPath);
      
      if (item.startsWith('openclaw-mem-recall-backup-')) {
        backups.push({
          name: item,
          path: fullPath,
          size: stat.size,
          date: stat.mtime
        });
      }
    }

    return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // 清理旧备份
  async cleanOldBackups(keepCount: number = 10): Promise<number> {
    const backups = this.listBackups();
    const toDelete = backups.slice(keepCount);
    
    for (const backup of toDelete) {
      await this.removeDirectory(backup.path);
    }
    
    return toDelete.length;
  }

  // 辅助方法
  private async copyFile(source: string, target: string): Promise<void> {
    await pipeline(
      createReadStream(source),
      createWriteStream(target)
    );
  }

  private async copyDirectory(source: string, target: string): Promise<void> {
    mkdirSync(target, { recursive: true });
    const items = readdirSync(source);

    for (const item of items) {
      const sourcePath = join(source, item);
      const targetPath = join(target, item);
      const stat = statSync(sourcePath);

      if (stat.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        await this.copyFile(sourcePath, targetPath);
      }
    }
  }

  private async compressDirectory(source: string, target: string): Promise<void> {
    // 简化实现：使用 tar 命令
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    await execAsync(`tar -czf "${target}" -C "${join(source, '..')}" "${basename(source)}"`);
  }

  private async decompressArchive(source: string, target: string): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    mkdirSync(target, { recursive: true });
    await execAsync(`tar -xzf "${source}" -C "${target}"`);
  }

  private async removeDirectory(path: string): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    await execAsync(`rm -rf "${path}"`);
  }
}