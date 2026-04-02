import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ConfigManager } from './config.js';
import { WorkspaceManager } from './workspace.js';

export interface DiagnosticResult {
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
}

export class Diagnostics {
  private config: ConfigManager;
  private workspaces: WorkspaceManager;

  constructor() {
    this.config = new ConfigManager();
    this.workspaces = new WorkspaceManager();
  }

  async run(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    // 1. 检查配置文件
    results.push(this.checkConfig());

    // 2. 检查工作区
    results.push(this.checkWorkspace());

    // 3. 检查数据库
    results.push(await this.checkDatabase());

    // 4. 检查内存目录结构
    results.push(this.checkDirectoryStructure());

    // 5. 检查最近的日志
    results.push(this.checkRecentLogs());

    // 6. 检查备份
    results.push(this.checkBackups());

    return results;
  }

  private checkConfig(): DiagnosticResult {
    try {
      const config = this.config.get();
      return {
        status: 'ok',
        message: '配置文件正常',
        details: `工作区: ${config.workspacePath}`
      };
    } catch (error) {
      return {
        status: 'error',
        message: '配置文件错误',
        details: String(error)
      };
    }
  }

  private checkWorkspace(): DiagnosticResult {
    try {
      const current = this.workspaces.getCurrentWorkspace();
      if (existsSync(current.path)) {
        return {
          status: 'ok',
          message: `当前工作区: ${current.name}`,
          details: `路径: ${current.path}`
        };
      } else {
        return {
          status: 'error',
          message: `工作区不存在: ${current.name}`,
          details: `路径: ${current.path}`
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: '工作区检查失败',
        details: String(error)
      };
    }
  }

  private async checkDatabase(): Promise<DiagnosticResult> {
    try {
      const { MemoryDatabase } = await import('./database.js');
      const workspace = this.workspaces.getCurrentWorkspace();
      const db = new MemoryDatabase(workspace.path);
      await db.init();
      
      // 尝试简单查询
      const entities = await db.getEntities();
      await db.close();

      return {
        status: 'ok',
        message: '数据库正常',
        details: `实体数量: ${entities.length}`
      };
    } catch (error) {
      return {
        status: 'error',
        message: '数据库错误',
        details: String(error)
      };
    }
  }

  private checkDirectoryStructure(): DiagnosticResult {
    const workspace = this.workspaces.getCurrentWorkspace();
    const requiredDirs = ['memory', 'bank', 'bank/entities'];
    const missing: string[] = [];

    for (const dir of requiredDirs) {
      const fullPath = join(workspace.path, dir);
      if (!existsSync(fullPath)) {
        missing.push(dir);
      }
    }

    if (missing.length === 0) {
      return {
        status: 'ok',
        message: '目录结构完整'
      };
    } else {
      return {
        status: 'warning',
        message: '缺少部分目录',
        details: `缺失: ${missing.join(', ')}`
      };
    }
  }

  private checkRecentLogs(): DiagnosticResult {
    const workspace = this.workspaces.getCurrentWorkspace();
    const memoryDir = join(workspace.path, 'memory');
    
    if (!existsSync(memoryDir)) {
      return {
        status: 'warning',
        message: 'memory 目录不存在'
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const todayLog = join(memoryDir, `${today}.md`);
    
    if (existsSync(todayLog)) {
      return {
        status: 'ok',
        message: '今日日志已创建',
        details: todayLog
      };
    } else {
      return {
        status: 'warning',
        message: '今日日志未创建',
        details: '建议运行: openclaw-memory log "今日记录"'
      };
    }
  }

  private checkBackups(): DiagnosticResult {
    const backupDir = join(require('os').homedir(), '.openclaw-memory-backups');
    
    if (!existsSync(backupDir)) {
      return {
        status: 'warning',
        message: '备份目录不存在',
        details: '建议运行: openclaw-memory backup'
      };
    }

    const { readdirSync } = require('fs');
    const backups = readdirSync(backupDir).filter((f: string) => 
      f.startsWith('openclaw-memory-backup-')
    );

    if (backups.length === 0) {
      return {
        status: 'warning',
        message: '暂无备份',
        details: '建议运行: openclaw-memory backup'
      };
    }

    return {
      status: 'ok',
      message: `备份正常 (${backups.length} 个)`
    };
  }

  print(results: DiagnosticResult[]): void {
    console.log(chalk.blue('🔍 OpenClaw Memory 诊断报告'));
    console.log();

    for (const result of results) {
      const icon = {
        ok: chalk.green('✅'),
        warning: chalk.yellow('⚠️'),
        error: chalk.red('❌')
      }[result.status];

      console.log(`${icon} ${result.message}`);
      if (result.details) {
        console.log(chalk.gray(`   ${result.details}`));
      }
    }

    console.log();
    
    const errors = results.filter(r => r.status === 'error');
    const warnings = results.filter(r => r.status === 'warning');

    if (errors.length === 0 && warnings.length === 0) {
      console.log(chalk.green('🎉 所有检查通过！'));
    } else {
      console.log(chalk.yellow(`⚠️  发现 ${errors.length} 个错误, ${warnings.length} 个警告`));
    }
  }
}