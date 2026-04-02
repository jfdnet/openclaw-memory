# OpenClaw Memory

OpenClaw 工作区记忆系统 - 离线优先、Markdown 原生、结构化回忆

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/jfdnet/openclaw-memory)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 特性

- 📅 **每日日志**: Markdown 原生，仅追加模式，支持 `## Retain` 标记
- 🏦 **Bank 系统**: 类型化记忆（world/experience/opinions/entities）
- 🔍 **全文检索**: SQLite FTS5 离线词法搜索
- 🧠 **语义检索**: 支持 OpenAI 和 Ollama 本地嵌入模型
- 🔄 **反思任务**: 自动整理记忆、更新实体、追踪观点演变
- 📊 **实体追踪**: 以实体为中心的知识管理
- 💼 **多工作区**: 支持多个独立工作区
- 🔧 **诊断工具**: 系统健康检查和问题排查
- 💾 **备份恢复**: 完整的备份和恢复功能

## 安装

```bash
npm install -g openclaw-mem-recall
```

## 快速开始

```bash
# 初始化工作区记忆
openclaw-mem-recall init

# 快速记录记忆
openclaw-mem-recall log "完成了重要功能开发" --type B --entities project

# 索引所有日志
openclaw-mem-recall index

# 搜索记忆
openclaw-mem-recall recall "功能开发"

# 运行反思任务
openclaw-mem-recall reflect
```

## 工作区结构

```
~/.openclaw/workspace/
├── memory.md              # 核心记忆和偏好
├── memory/
│   └── YYYY-MM-DD.md      # 每日日志
└── bank/
    ├── world.md           # 客观事实
    ├── experience.md      # 经历记录
    ├── opinions.md        # 观点偏好
    └── entities/
        └── jfd.md         # 实体档案
```

## 完整命令参考

### 核心命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `init` | 初始化工作区 | `openclaw-mem-recall init` |
| `log <content>` | 快速记录记忆 | `openclaw-mem-recall log "完成了功能" --type B --entities main` |
| `index` | 索引所有日志 | `openclaw-mem-recall index` |
| `recall <query>` | 搜索记忆 | `openclaw-mem-recall recall "OpenClaw"` |
| `entities` | 列出所有实体 | `openclaw-mem-recall entities` |

### 高级查询

| 命令 | 说明 | 示例 |
|------|------|------|
| `timerange <start> <end>` | 时间范围查询 | `openclaw-mem-recall timerange 2026-04-01 2026-04-02` |
| `opinion <statement>` | 查看观点演变 | `openclaw-mem-recall opinion "备份策略"` |
| `reflect` | 运行反思任务 | `openclaw-mem-recall reflect --date 2026-04-02` |

### 配置管理

| 命令 | 说明 | 示例 |
|------|------|------|
| `config --list` | 列出所有配置 | `openclaw-mem-recall config --list` |
| `config --get <key>` | 获取配置项 | `openclaw-mem-recall config --get workspacePath` |
| `config --set <key> --value <val>` | 设置配置项 | `openclaw-mem-recall config --set enableEmbedding --value true` |
| `config --reset` | 重置为默认 | `openclaw-mem-recall config --reset` |

### 备份恢复

| 命令 | 说明 | 示例 |
|------|------|------|
| `backup` | 创建备份 | `openclaw-mem-recall backup` |
| `backup --list` | 列出备份 | `openclaw-mem-recall backup --list` |
| `backup --clean` | 清理旧备份 | `openclaw-mem-recall backup --clean --keep 5` |
| `restore <backup>` | 恢复备份 | `openclaw-mem-recall restore ~/backups/xxx.tar.gz` |

### 多工作区

| 命令 | 说明 | 示例 |
|------|------|------|
| `workspace --list` | 列出工作区 | `openclaw-mem-recall workspace --list` |
| `workspace --add <name> --path <path>` | 添加工作区 | `openclaw-mem-recall workspace --add work ~/work --description "工作项目"` |
| `workspace --use <name>` | 切换工作区 | `openclaw-mem-recall workspace --use work` |
| `workspace --remove <name>` | 删除工作区 | `openclaw-mem-recall workspace --remove work` |

### Ollama 本地嵌入

| 命令 | 说明 | 示例 |
|------|------|------|
| `ollama --check` | 检查 Ollama 状态 | `openclaw-mem-recall ollama --check` |
| `ollama --list` | 列出模型 | `openclaw-mem-recall ollama --list` |
| `ollama --set <model>` | 设置模型 | `openclaw-mem-recall ollama --set nomic-embed-text` |

### 诊断工具

| 命令 | 说明 | 示例 |
|------|------|------|
| `doctor` | 系统诊断 | `openclaw-mem-recall doctor` |

## 日志格式

每日日志支持 `## Retain` 部分，使用类型前缀标记：

```markdown
## Retain
- W @entity: 客观事实（World）
- B @entity: 经历记录（Biography/Experience）
- O(c=0.9) @entity: 观点偏好（Opinion），带置信度
- S @entity: 观察摘要（Summary）
```

示例：
```markdown
## Retain
- B @main: 更新到 OpenClaw 2026.4.1
- W @project: 项目已部署到生产环境
- O(c=0.95) @user: 偏好简洁的回复
```

## 配置选项

配置文件位于 `~/.openclaw-memory.json`：

```json
{
  "workspacePath": "/Users/jfd/.openclaw/workspace",
  "enableReflection": true,
  "reflectionInterval": 1,
  "enableEmbedding": false,
  "embeddingProvider": "openai",
  "embeddingApiKey": "sk-...",
  "embeddingModel": "text-embedding-3-small",
  "logLevel": "info",
  "backupEnabled": true,
  "backupInterval": 7
}
```

## 使用 Ollama 本地嵌入

1. 安装 Ollama：
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

2. 拉取嵌入模型：
```bash
ollama pull nomic-embed-text
```

3. 配置使用 Ollama：
```bash
openclaw-mem-recall ollama --set nomic-embed-text
openclaw-mem-recall config --set embeddingProvider --value ollama
```

## 开发

```bash
# 克隆项目
git clone https://github.com/jfdnet/openclaw-memory.git
cd openclaw-memory

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 运行测试
npm test
```

## 架构

```
src/
├── database.ts      # SQLite + FTS5 数据库
├── parser.ts        # 日志解析器
├── logwriter.ts     # 日志写入器
├── memory.ts        # 核心记忆系统
├── reflection.ts    # 反思任务
├── embedding.ts     # OpenAI 嵌入
├── ollama.ts        # Ollama 本地嵌入
├── workspace.ts     # 多工作区管理
├── backup.ts        # 备份恢复
├── config.ts        # 配置管理
├── diagnostics.ts   # 诊断工具
└── errors.ts        # 错误处理
```

## 许可证

MIT
