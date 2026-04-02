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
  .version('0.1.0');

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

program.parse();