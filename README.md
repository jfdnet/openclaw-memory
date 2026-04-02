# OpenClaw Memory

OpenClaw 工作区记忆系统 - 离线优先、Markdown 原生、结构化回忆

## 特性

- 📅 **每日日志**: Markdown 原生，仅追加模式
- 🏦 **Bank 系统**: 类型化记忆（world/experience/opinions/entities）
- 🔍 **全文检索**: SQLite FTS5 离线词法搜索
- 🧠 **语义检索**: 可选的嵌入向量支持
- 🔄 **反思任务**: 自动整理和置信度更新
- 📊 **实体追踪**: 以实体为中心的知识管理

## 安装

```bash
npm install -g openclaw-memory
```

## 快速开始

```bash
# 初始化工作区记忆
openclaw-memory init

# 记录今日记忆
openclaw-memory log "完成了重要功能开发"

# 搜索记忆
openclaw-memory recall "功能开发"

# 运行反思任务
openclaw-memory reflect
```

## 工作区结构

```
~/.openclaw/workspace/
├── memory.md              # 核心记忆
├── memory/
│   └── YYYY-MM-DD.md      # 每日日志
└── bank/
    ├── world.md           # 客观事实
    ├── experience.md      # 经历记录
    ├── opinions.md        # 观点偏好
    └── entities/
        └── jfd.md         # 实体档案
```

## 文档

- [架构设计](docs/ARCHITECTURE.md)
- [API 参考](docs/API.md)
- [贡献指南](CONTRIBUTING.md)

## 许可证

MIT
