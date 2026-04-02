#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { OpenClawMemory } from '../src/memory.js';
import { homedir } from 'os';
import { join } from 'path';

const program = new Command();

program
  .name('openclaw-memory')
  .description('OpenClaw 工作区记忆系统')
  .version('0.4.0');

program
  .command('log')
  .description('快速记录一条记忆')
  .argument('<content>', '记忆内容')
  .option('-t, --type <type>', '类型 (W/B/O/S)', 'B')
  .option('-e, --entities <entities>', '实体，逗号分隔', '')
  .option('-c, --confidence <number>', '置信度 (0-1)', '1.0')
  .option('-d, --date <date>', '日期 (YYYY-MM-DD)', new Date().toISOString().split('T')[0])
  .option('-w, --workspace <path>', '工作区路径', join(homedir(), '.openclaw', 'workspace'))
  .action(async (content, options) => {
    try {
      const { LogWriter } = await import('../src/logwriter.js');
      
      const writer = new LogWriter(options.workspace);
      
      const entry = {
        type: options.type.toUpperCase() as 'W' | 'B' | 'O' | 'S',
        entities: options.entities ? options.entities.split(',').map((e: string) => e.trim()) : [],
        content,
        confidence: parseFloat(options.confidence)
      };

      const logPath = await writer.log(entry, options.date);
      console.log(chalk.green('✅ 记忆已记录'));
      console.log(chalk.gray(`文件: ${logPath}`));
      
      // 自动索引
      const memory = new OpenClawMemory({
        workspacePath: options.workspace,
        enableReflection: false,
        reflectionInterval: 7
      });
      await memory.init();
      const count = await memory.indexDailyLog(options.date);
      if (count > 0) {
        console.log(chalk.gray(`已索引 ${count} 条记忆到数据库`));
      }
      await memory.close();
      
    } catch (error: any) {
      console.error(chalk.red('❌ 记录失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('初始化工作区记忆系统')
  .option('-w, --workspace <path>', '工作区路径', join(homedir(), '.openclaw', 'workspace'))
  .action(async (options) => {
    try {
      const memory = new OpenClawMemory({
        workspacePath: options.workspace,
        enableReflection: true,
        reflectionInterval: 7
      });

      await memory.init();
      console.log(chalk.green('✅ 工作区记忆系统已初始化'));
      console.log(chalk.gray(`工作区: ${options.workspace}`));
      
      await memory.close();
    } catch (error) {
      console.error(chalk.red('❌ 初始化失败:'), error);
      process.exit(1);
    }
  });

program
  .command('index')
  .description('索引所有每日日志')
  .option('-w, --workspace <path>', '工作区路径', join(homedir(), '.openclaw', 'workspace'))
  .action(async (options) => {
    try {
      const memory = new OpenClawMemory({
        workspacePath: options.workspace,
        enableReflection: true,
        reflectionInterval: 7
      });

      await memory.init();
      console.log(chalk.blue('🔍 正在索引日志...'));
      
      const count = await memory.indexAllLogs();
      console.log(chalk.green(`✅ 已索引 ${count} 条记忆`));
      
      await memory.close();
    } catch (error) {
      console.error(chalk.red('❌ 索引失败:'), error);
      process.exit(1);
    }
  });

program
  .command('recall')
  .description('回忆记忆')
  .argument('<query>', '搜索查询')
  .option('-w, --workspace <path>', '工作区路径', join(homedir(), '.openclaw', 'workspace'))
  .option('-l, --limit <number>', '返回数量', '10')
  .option('-e, --entity <name>', '按实体搜索')
  .action(async (query, options) => {
    try {
      const memory = new OpenClawMemory({
        workspacePath: options.workspace,
        enableReflection: true,
        reflectionInterval: 7
      });

      await memory.init();
      
      let results;
      if (options.entity) {
        results = await memory.recallByEntity(options.entity, parseInt(options.limit));
      } else {
        results = await memory.recall(query, { limit: parseInt(options.limit) });
      }

      if (results.length === 0) {
        console.log(chalk.yellow('未找到相关记忆'));
      } else {
        console.log(chalk.blue(`找到 ${results.length} 条记忆:`));
        console.log();
        
        for (const fact of results) {
          const kindColor = {
            world: chalk.cyan,
            experience: chalk.green,
            opinion: chalk.yellow,
            observation: chalk.gray
          }[fact.kind];

          console.log(kindColor(`[${fact.kind.toUpperCase()}]`) + ' ' + fact.content);
          console.log(chalk.gray(`  来源: ${fact.source} | 时间: ${fact.timestamp}`));
          if (fact.entities.length > 0) {
            console.log(chalk.gray(`  实体: ${fact.entities.join(', ')}`));
          }
          console.log();
        }
      }
      
      await memory.close();
    } catch (error) {
      console.error(chalk.red('❌ 搜索失败:'), error);
      process.exit(1);
    }
  });

program
  .command('entities')
  .description('列出所有实体')
  .option('-w, --workspace <path>', '工作区路径', join(homedir(), '.openclaw', 'workspace'))
  .action(async (options) => {
    try {
      const memory = new OpenClawMemory({
        workspacePath: options.workspace,
        enableReflection: true,
        reflectionInterval: 7
      });

      await memory.init();
      
      const entities = await memory.getEntities();
      
      if (entities.length === 0) {
        console.log(chalk.yellow('暂无实体'));
      } else {
        console.log(chalk.blue(`共有 ${entities.length} 个实体:`));
        console.log();
        
        for (const entity of entities) {
          console.log(chalk.cyan(entity.name) + chalk.gray(` (${entity.slug})`));
          const summaryLines = entity.summary.split('\n').slice(0, 3);
          for (const line of summaryLines) {
            console.log('  ' + chalk.gray(line));
          }
          if (entity.summary.split('\n').length > 3) {
            console.log('  ' + chalk.gray('...'));
          }
          console.log();
        }
      }
      
      await memory.close();
    } catch (error) {
      console.error(chalk.red('❌ 获取实体失败:'), error);
      process.exit(1);
    }
  });

program
  .command('reflect')
  .description('运行反思任务，整理记忆')
  .option('-w, --workspace <path>', '工作区路径', join(homedir(), '.openclaw', 'workspace'))
  .option('-d, --date <date>', '指定日期 (YYYY-MM-DD)', new Date().toISOString().split('T')[0])
  .action(async (options) => {
    try {
      const { ReflectionTask } = await import('../src/reflection.js');
      
      const memory = new OpenClawMemory({
        workspacePath: options.workspace,
        enableReflection: true,
        reflectionInterval: 1
      });

      await memory.init();
      
      const reflection = new ReflectionTask(memory, {
        workspacePath: options.workspace,
        minConfidenceThreshold: 0.7,
        maxFactsPerReflection: 50
      });

      console.log(chalk.blue('🔄 运行反思任务...'));
      const result = await reflection.runDailyReflection(options.date);
      
      console.log(chalk.green('✅ 反思完成'));
      console.log(chalk.gray(`  更新实体: ${result.entitiesUpdated}`));
      console.log(chalk.gray(`  观点演变: ${result.opinionsRevised}`));
      console.log(chalk.gray(`  新洞察: ${result.newInsights.length}`));
      
      if (result.newInsights.length > 0) {
        console.log(chalk.cyan('\n💡 新洞察:'));
        for (const insight of result.newInsights) {
          console.log(chalk.cyan(`  - ${insight}`));
        }
      }
      
      await memory.close();
    } catch (error) {
      console.error(chalk.red('❌ 反思任务失败:'), error);
      process.exit(1);
    }
  });

program
  .command('timerange')
  .description('查询时间范围的记忆')
  .argument('<start>', '开始日期 (YYYY-MM-DD)')
  .argument('<end>', '结束日期 (YYYY-MM-DD)')
  .option('-w, --workspace <path>', '工作区路径', join(homedir(), '.openclaw', 'workspace'))
  .option('-l, --limit <number>', '返回数量', '100')
  .action(async (start, end, options) => {
    try {
      const memory = new OpenClawMemory({
        workspacePath: options.workspace,
        enableReflection: false,
        reflectionInterval: 7
      });

      await memory.init();
      
      console.log(chalk.blue(`🔍 查询 ${start} 到 ${end} 的记忆...`));
      const results = await memory.recallByTimeRange(start, end, parseInt(options.limit));
      
      if (results.length === 0) {
        console.log(chalk.yellow('未找到相关记忆'));
      } else {
        console.log(chalk.green(`找到 ${results.length} 条记忆:`));
        console.log();
        
        for (const fact of results) {
          const kindColor = {
            world: chalk.cyan,
            experience: chalk.green,
            opinion: chalk.yellow,
            observation: chalk.gray
          }[fact.kind];

          console.log(kindColor(`[${fact.kind.toUpperCase()}]`) + ' ' + fact.content);
          console.log(chalk.gray(`  来源: ${fact.source} | 时间: ${fact.timestamp}`));
          if (fact.confidence) {
            console.log(chalk.gray(`  置信度: ${fact.confidence}`));
          }
          console.log();
        }
      }
      
      await memory.close();
    } catch (error) {
      console.error(chalk.red('❌ 查询失败:'), error);
      process.exit(1);
    }
  });

program
  .command('opinion')
  .description('查看观点演变历史')
  .argument('<statement>', '观点陈述')
  .option('-w, --workspace <path>', '工作区路径', join(homedir(), '.openclaw', 'workspace'))
  .action(async (statement, options) => {
    try {
      const memory = new OpenClawMemory({
        workspacePath: options.workspace,
        enableReflection: false,
        reflectionInterval: 7
      });

      await memory.init();
      
      console.log(chalk.blue(`📊 查询观点演变: "${statement}"`));
      const history = await memory.getOpinionHistory(statement);
      
      if (history.length === 0) {
        console.log(chalk.yellow('未找到该观点的历史记录'));
      } else {
        console.log(chalk.green(`找到 ${history.length} 条历史记录:`));
        console.log();
        
        for (const record of history) {
          const confidenceBar = '█'.repeat(Math.round(record.confidence * 10)) + '░'.repeat(10 - Math.round(record.confidence * 10));
          console.log(chalk.yellow(`[${record.timestamp}]`) + ` 置信度: ${confidenceBar} ${record.confidence.toFixed(2)}`);
        }
      }
      
      await memory.close();
    } catch (error) {
      console.error(chalk.red('❌ 查询失败:'), error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('配置管理')
  .option('-g, --get <key>', '获取配置项')
  .option('-s, --set <key>', '设置配置项')
  .option('-v, --value <value>', '配置值')
  .option('-l, --list', '列出所有配置')
  .option('-r, --reset', '重置为默认配置')
  .action(async (options) => {
    try {
      const { ConfigManager } = await import('../src/config.js');
      const config = new ConfigManager();

      if (options.reset) {
        config.reset();
        console.log(chalk.green('✅ 配置已重置为默认值'));
        return;
      }

      if (options.list) {
        console.log(chalk.blue('当前配置:'));
        console.log(chalk.gray(`配置文件: ${config.getConfigPath()}`));
        console.log();
        const current = config.get();
        for (const [key, value] of Object.entries(current)) {
          if (key.includes('Key') || key.includes('Secret')) {
            console.log(`${key}: ${chalk.gray('***隐藏***')}`);
          } else {
            console.log(`${key}: ${chalk.cyan(value)}`);
          }
        }
        return;
      }

      if (options.get) {
        const current = config.get();
        const value = current[options.get as keyof typeof current];
        console.log(`${options.get}: ${chalk.cyan(value)}`);
        return;
      }

      if (options.set && options.value) {
        config.set(options.set, options.value);
        console.log(chalk.green(`✅ 已设置 ${options.set} = ${options.value}`));
        return;
      }

      console.log(chalk.yellow('请使用 --get, --set, --list 或 --reset'));
    } catch (error: any) {
      console.error(chalk.red('❌ 配置操作失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('backup')
  .description('创建备份')
  .option('-w, --workspace <path>', '工作区路径', join(homedir(), '.openclaw', 'workspace'))
  .option('-d, --dir <directory>', '备份目录', join(homedir(), '.openclaw-memory-backups'))
  .option('-l, --list', '列出所有备份')
  .option('-c, --clean', '清理旧备份')
  .option('-k, --keep <number>', '保留备份数量', '10')
  .action(async (options) => {
    try {
      const { BackupManager } = await import('../src/backup.js');
      const backup = new BackupManager({
        workspacePath: options.workspace,
        backupDir: options.dir
      });

      if (options.list) {
        const backups = backup.listBackups();
        if (backups.length === 0) {
          console.log(chalk.yellow('暂无备份'));
        } else {
          console.log(chalk.blue(`共有 ${backups.length} 个备份:`));
          for (const b of backups) {
            const size = (b.size / 1024 / 1024).toFixed(2);
            console.log(`  ${chalk.cyan(b.name)} ${chalk.gray(`${size}MB ${b.date.toLocaleString()}`)}`);
          }
        }
        return;
      }

      if (options.clean) {
        const deleted = await backup.cleanOldBackups(parseInt(options.keep));
        console.log(chalk.green(`✅ 已清理 ${deleted} 个旧备份`));
        return;
      }

      console.log(chalk.blue('📦 正在创建备份...'));
      const backupPath = await backup.createBackup();
      console.log(chalk.green('✅ 备份完成'));
      console.log(chalk.gray(`位置: ${backupPath}`));
    } catch (error: any) {
      console.error(chalk.red('❌ 备份失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('restore')
  .description('恢复备份')
  .argument('<backup>', '备份文件或目录')
  .option('-w, --workspace <path>', '工作区路径', join(homedir(), '.openclaw', 'workspace'))
  .action(async (backupPath, options) => {
    try {
      const { BackupManager } = await import('../src/backup.js');
      const backup = new BackupManager({
        workspacePath: options.workspace,
        backupDir: ''
      });

      console.log(chalk.yellow('⚠️  恢复将覆盖当前工作区的数据！'));
      console.log(chalk.blue('🔄 正在恢复备份...'));
      
      await backup.restoreBackup(backupPath);
      console.log(chalk.green('✅ 恢复完成'));
    } catch (error: any) {
      console.error(chalk.red('❌ 恢复失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('workspace')
  .description('多工作区管理')
  .option('-l, --list', '列出所有工作区')
  .option('-a, --add <name>', '添加工作区')
  .option('-p, --path <path>', '工作区路径')
  .option('-d, --description <desc>', '工作区描述')
  .option('-r, --remove <name>', '删除工作区')
  .option('-u, --use <name>', '切换工作区')
  .action(async (options) => {
    try {
      const { WorkspaceManager } = await import('../src/workspace.js');
      const manager = new WorkspaceManager();

      if (options.list) {
        const workspaces = manager.list();
        console.log(chalk.blue(`共有 ${workspaces.length} 个工作区:`));
        const current = manager.getCurrent();
        
        for (const ws of workspaces) {
          const isCurrent = ws.name === current;
          const marker = isCurrent ? chalk.green('→ ') : '  ';
          console.log(`${marker}${chalk.cyan(ws.name)} ${isCurrent ? chalk.green('(当前)') : ''}`);
          console.log(chalk.gray(`    路径: ${ws.path}`));
          if (ws.description) {
            console.log(chalk.gray(`    描述: ${ws.description}`));
          }
        }
        return;
      }

      if (options.add && options.path) {
        manager.add(options.add, options.path, options.description);
        console.log(chalk.green(`✅ 工作区 "${options.add}" 已添加`));
        return;
      }

      if (options.remove) {
        manager.remove(options.remove);
        console.log(chalk.green(`✅ 工作区 "${options.remove}" 已删除`));
        return;
      }

      if (options.use) {
        manager.use(options.use);
        manager.setCurrent(options.use);
        console.log(chalk.green(`✅ 已切换到工作区 "${options.use}"`));
        return;
      }

      console.log(chalk.yellow('请使用 --list, --add, --remove 或 --use'));
    } catch (error: any) {
      console.error(chalk.red('❌ 工作区操作失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('诊断和排查问题')
  .action(async () => {
    try {
      const { Diagnostics } = await import('../src/diagnostics.js');
      const diagnostics = new Diagnostics();
      const results = await diagnostics.run();
      diagnostics.print(results);
    } catch (error: any) {
      console.error(chalk.red('❌ 诊断失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('ollama')
  .description('Ollama 本地嵌入管理')
  .option('-c, --check', '检查 Ollama 是否可用')
  .option('-l, --list', '列出可用模型')
  .option('-s, --set <model>', '设置默认模型')
  .action(async (options) => {
    try {
      const { OllamaEmbeddingService } = await import('../src/ollama.js');
      const ollama = new OllamaEmbeddingService({
        baseURL: 'http://localhost:11434',
        model: 'nomic-embed-text'
      });

      if (options.check) {
        const available = await ollama.checkAvailability();
        if (available) {
          console.log(chalk.green('✅ Ollama 服务正常运行'));
        } else {
          console.log(chalk.red('❌ Ollama 服务未启动'));
          console.log(chalk.gray('请运行: ollama serve'));
        }
        return;
      }

      if (options.list) {
        const models = await ollama.listModels();
        if (models.length === 0) {
          console.log(chalk.yellow('暂无可用模型'));
        } else {
          console.log(chalk.blue('可用模型:'));
          for (const model of models) {
            console.log(`  ${chalk.cyan(model)}`);
          }
        }
        return;
      }

      if (options.set) {
        const config = new (await import('../src/config.js')).ConfigManager();
        config.set('embeddingProvider', 'ollama');
        config.set('embeddingModel', options.set);
        console.log(chalk.green(`✅ 已设置 Ollama 模型: ${options.set}`));
        return;
      }

      console.log(chalk.yellow('请使用 --check, --list 或 --set'));
    } catch (error: any) {
      console.error(chalk.red('❌ Ollama 操作失败:'), error.message);
      process.exit(1);
    }
  });

program.parse();