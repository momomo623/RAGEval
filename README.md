# 灵鉴 RAG评测系统 | RAGEval 
✨ 开箱即用的RAG系统自动化评估工具 | One-stop RAG Evaluation Solution

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.68%2B-blue.svg)](https://fastapi.tiangolo.com/)

> !!! 项目仍在开发中，当前已完成后端部分...

## 🚀 项目简介

灵鉴（RAGEval）是一款专业的RAG系统评测工具，提供从数据准备、自动评测到报告生成的全流程解决方案。系统支持：

✅ **多维评估** - 准确性/相关性/完整性/响应速度等核心指标  
✅ **混合评测** - 自动AI评测 + 人工审核双模式  
✅ **智能分析** - 可视化报告与性能瓶颈定位  
✅ **高效部署** - Docker一键启动 + 开箱即用配置

## 🌟 核心功能

### 📦 项目管理
- 快速创建评测项目
- 自定义评测维度与权重
- 多项目对比分析

### 💡 问答数据管理
- 支持Excel/CSV批量导入
- 大模型智能生成问答对
- 问答数据版本控制

### 🔍 评测引擎
- 自动化AI评测（支持GPT/Claude等主流模型）
- 人工评测协作平台
- 混合评测工作流
- 性能压力测试（QPS/响应时延/稳定性）

### 📊 智能报告
- 多维数据可视化
- 问题答案差异对比
- 可导出PDF/Excel报告
- 历史版本对比

## 🛠 快速开始

### 前置要求
- Python 3.9+
- PostgreSQL 12+
- Redis 6+

### 启动步骤
```bash
# 克隆仓库
git clone https://github.com/your-org/rageval.git

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env

# 初始化数据库
python -m app.db.init_db

# 启动服务
uvicorn app.main:app --reload
```

### Docker启动
```bash
docker-compose up -d
```

## ⚙️ 配置说明

### 环境变量配置（.env）
```ini
# 大模型配置
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
EVALUATION_MODEL_NAME=gpt-4-turbo

# 数据库配置
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=rageval
```

## 📐 系统架构

```
                          +-----------------+
                          |    前端 React    |
                          +--------+--------+
                                   |
                          +--------v--------+
                          |   FastAPI 网关   |
                          +--------+--------+
                                   |
+-----------------+       +--------v--------+       +-----------------+
|  评测任务队列     <----->+   评测引擎服务    +------->   PostgreSQL    |
|  (Celery/Redis)  |       +--------+--------+       +-----------------+
+-----------------+                |
                          +--------v--------+
                          |  大模型API服务   |
                          +-----------------+
```

## 🤝 参与贡献

欢迎提交Issue和PR！请遵循以下流程：
1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/your-feature`)
3. 提交修改 (`git commit -m 'Add some feature'`)
4. 推送分支 (`git push origin feature/your-feature`)
5. 新建Pull Request

## 📄 开源协议

本项目采用 [MIT License](LICENSE)
```

主要亮点说明：
1. 采用徽章增强专业感
2. 功能展示使用图标+简明要点
3. 包含快速启动的代码块
4. 系统架构用ASCII图示直观展示
5. 强调开箱即用特性
6. 包含贡献指南和开源协议
7. 关键配置项单独列出
8. 支持传统部署和Docker两种方式

可根据实际需求调整环境变量配置和架构细节。建议在Github仓库中添加以下标签提升曝光：
`rag` `evaluation` `nlp` `ai-testing` `llm`
