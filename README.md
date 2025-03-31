# 灵鉴 RAG评测系统 | RAGEval 
✨ 开箱即用的RAG系统自动化评估工具 | One-stop RAG Evaluation Solution

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.68%2B-blue.svg)](https://fastapi.tiangolo.com/)

> 本项目使用Trae来创建，在此感谢Trae提供的帮助。
> Trae国内版下载：https://sourl.co/CPViZT｜Trae海外版体验：https://sourl.co/GeVt9r



已完成：
- ✅ 项目管理。创建项目，选择数据集，进行性能测试（收集RAG系统回答）、精度测试（基本完成）、评估报告（未完成）。
- ✅ 数据集相关功能。创建数据集，单个/批量新增问答对/RAG问答。
- ✅ 系统配置。配置大模型API、自有RAG系统API，并进行健康检查。
- ✅ AI生成问答对。上传文档，进行文档切分，并行请求大模型API生成问答对。

未完成：
- 🔜  评测引擎。人工评测（未完成）。
- 🔜  报告生成。生成评估报告（未完成）。

> !!! 项目基本完成，有些功能待完善，逐步编写中 !!!
> 当前很多文件有待整理，基本功能完成，会逐步完善。


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


### Docker启动
```bash
cd docker
docker-compose up -d
```

## 📐 系统架构


## 🤝 参与贡献

欢迎提交Issue和PR！请遵循以下流程：
1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/your-feature`)
3. 提交修改 (`git commit -m 'Add some feature'`)
4. 推送分支 (`git push origin feature/your-feature`)
5. 新建Pull Request

## 📄 开源协议

本项目采用 [MIT License](LICENSE)
