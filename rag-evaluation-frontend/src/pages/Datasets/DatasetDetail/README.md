# 数据集详情页面

## 功能概述

数据集详情页面是RAG评测系统中的核心页面之一，用于展示和管理单个数据集的详细信息。该页面包含以下主要功能：

1. **数据集基本信息展示**：显示数据集的名称、描述、标签、创建时间和问题数量等基本信息
2. **问题列表管理**：查看、添加、编辑、删除数据集中的问题
3. **RAG回答管理**：为问题添加、编辑、删除RAG系统的回答
4. **关联项目展示**：查看使用该数据集的项目列表
5. **AI生成问答对**：使用AI自动生成问题和答案

页面采用了组件化的设计，将不同功能模块拆分为独立的组件，提高了代码的可维护性和复用性。

## 文件结构

```
rag-evaluation-frontend/src/pages/Datasets/DatasetDetail/
├── index.tsx                  # 主组件（父组件）
├── DatasetDetail.module.css   # 样式文件
├── README.md                  # 本文档
├── components/                # 子组件目录
│   ├── DatasetHeader.tsx      # 数据集头部组件
│   ├── QuestionListTab.tsx    # 问题列表标签页组件
│   ├── RelatedProjectsTab.tsx # 关联项目标签页组件
│   ├── AddQuestionModal.tsx   # 添加问题模态框组件
│   └── RagAnswerModal.tsx     # RAG回答编辑模态框组件
```

## 组件说明

### 主组件 (index.tsx)

主组件是整个数据集详情页面的入口，负责：
- 管理页面状态
- 处理数据获取和更新
- 组织子组件的布局
- 将相关的状态和回调函数传递给子组件

主要功能包括：
- 获取和显示数据集详情
- 获取和管理问题列表
- 处理问题的添加、编辑、删除操作
- 处理RAG回答的添加、编辑、删除操作
- 管理标签页切换逻辑

### 子组件

#### DatasetHeader.tsx

数据集头部组件，负责显示数据集的基本信息和操作按钮。

**主要功能**：
- 显示数据集名称、描述、标签
- 显示数据集的公开/私有状态
- 显示问题数量和创建时间
- 提供编辑、删除、导入、导出等操作按钮（根据用户权限显示不同操作）

#### QuestionListTab.tsx

问题列表标签页组件，负责显示和管理数据集中的问题列表。

**主要功能**：
- 以表格形式展示问题列表
- 支持搜索、分页、批量选择等功能
- 提供添加、编辑、删除问题的操作
- 显示问题的RAG回答状态
- 展开问题时显示RAG回答列表
- 支持添加、编辑、删除RAG回答

#### RelatedProjectsTab.tsx

关联项目标签页组件，负责显示使用该数据集的项目列表。

**主要功能**：
- 以卡片形式展示关联项目列表
- 提供查看项目详情的链接
- 当没有关联项目时显示提示信息

#### AddQuestionModal.tsx

添加问题模态框组件，负责提供添加问题的界面。

**主要功能**：
- 支持单个添加和批量添加两种模式
- 单个添加模式：提供表单填写问题、标准答案、分类、难度等信息
- 批量添加模式：支持Tab分隔或@@符号分隔的批量文本输入
- 支持添加RAG回答
- 批量添加时提供预览功能

#### RagAnswerModal.tsx

RAG回答编辑模态框组件，负责提供添加和编辑RAG回答的界面。

**主要功能**：
- 提供表单填写RAG回答内容
- 支持设置版本和收集方式
- 支持添加和更新操作

## 样式文件 (DatasetDetail.module.css)

样式文件包含了数据集详情页面所有组件的样式定义，采用CSS Module方式组织，避免样式冲突。主要包括：

- 页面布局样式
- 标题和信息展示样式
- 表格和操作按钮样式
- RAG回答展示样式
- 模态框和表单样式
- 响应式布局适配

## 使用方法

数据集详情页面通过路由参数获取数据集ID，然后加载对应的数据集信息。用户可以通过以下方式访问：

1. 从数据集列表页面点击数据集名称
2. 直接访问URL：`/datasets/:id`，其中`:id`是数据集的唯一标识符

## 开发注意事项

1. **组件通信**：子组件通过props接收父组件传递的状态和回调函数
2. **状态管理**：主要状态集中在父组件中管理，避免状态分散
3. **错误处理**：各组件中包含适当的错误处理和用户提示
4. **性能优化**：使用分页加载问题列表，避免一次加载过多数据
5. **响应式设计**：页面适配不同屏幕尺寸，在移动设备上也能良好展示

## 未来优化方向

1. 进一步拆分QuestionListTab组件，创建QuestionItem组件处理单个问题的渲染
2. 使用React.memo或useMemo优化组件渲染性能
3. 添加错误边界，防止组件错误影响整个应用
4. 考虑使用状态管理库（如Redux或Context API）简化状态传递
5. 增强批量导入功能，支持更多格式的数据导入
