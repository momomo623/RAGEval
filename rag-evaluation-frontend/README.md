# 🎨 RAG评测系统前端 | Frontend

基于 React 18 + TypeScript + Vite 构建的现代化前端应用，提供直观的RAG系统评测界面。

## 🚀 快速开始

### 环境要求
- Node.js 16.0+
- npm 或 yarn

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 访问应用
http://localhost:5173
```

## 📁 项目结构

```
src/
├── assets/          # 静态资源文件
├── components/      # 可复用组件
│   ├── common/      # 通用组件
│   ├── Layout/      # 布局组件
│   └── ConfigModal/ # 配置弹窗组件
├── hooks/           # 自定义React Hooks
├── pages/           # 页面组件
│   ├── Login/       # 登录页面
│   ├── Dashboard/   # 仪表板
│   ├── Projects/    # 项目管理
│   ├── CreateProject/ # 创建项目
│   ├── Datasets/    # 数据集管理
│   ├── QuestionGeneration/ # 问题生成
│   ├── Settings/    # 系统设置
│   └── Admin/       # 管理员页面
├── router/          # 路由配置
├── services/        # API服务层
├── types/           # TypeScript类型定义
├── utils/           # 工具函数
├── App.tsx          # 根组件
├── main.tsx         # 应用入口
└── index.css        # 全局样式
```

## 🧩 核心模块说明

### 📄 页面模块 (pages/)

- **Login/**: 用户登录和注册页面
- **Dashboard/**: 系统概览仪表板，显示项目统计和快速操作
- **Projects/**: 项目管理页面，包含项目列表、详情和评测结果
- **CreateProject/**: 创建新评测项目的向导页面
- **Datasets/**: 数据集管理，支持导入、编辑和版本控制
- **QuestionGeneration/**: AI问答对生成页面，基于文档自动生成测试数据
- **Settings/**: 系统配置页面，包含模型配置和RAG系统接入
- **Admin/**: 管理员功能页面，用户管理和系统监控

### 🔧 组件模块 (components/)

- **common/**: 通用UI组件，如按钮、表格、表单等可复用组件
- **Layout/**: 应用布局组件，包含导航栏、侧边栏和页面容器
- **ConfigModal/**: 配置相关的弹窗组件，用于各种设置操作

### 🌐 服务层 (services/)

- API请求封装，与后端FastAPI接口交互
- 统一的错误处理和响应格式化
- 请求拦截器和响应拦截器配置

### 🔗 路由模块 (router/)

- React Router配置
- 路由守卫和权限控制
- 页面懒加载配置

### 🎣 Hooks模块 (hooks/)

- 自定义React Hooks
- 状态管理和副作用处理
- 可复用的业务逻辑封装

### 📝 类型定义 (types/)

- TypeScript接口和类型定义
- API响应数据类型
- 组件Props类型定义

### 🛠️ 工具模块 (utils/)

- 通用工具函数
- 数据格式化和验证
- 常量定义和配置

## 🎨 技术栈

- **React 18**: 现代化React框架，支持并发特性
- **TypeScript**: 类型安全的JavaScript超集
- **Vite**: 快速的构建工具和开发服务器
- **Ant Design**: 企业级UI组件库
- **TailwindCSS**: 实用优先的CSS框架
- **React Router**: 声明式路由管理
- **Axios**: HTTP客户端库

## 🔧 开发配置

### ESLint配置
项目使用ESLint进行代码质量检查，配置文件：`eslint.config.js`

### TypeScript配置
- `tsconfig.json`: 主要TypeScript配置
- `tsconfig.app.json`: 应用代码配置
- `tsconfig.node.json`: Node.js环境配置

### Vite配置
`vite.config.ts`包含开发服务器、构建优化和插件配置

## 📦 构建和部署

### 开发环境
```bash
npm run dev    # 启动开发服务器
npm run build  # 构建生产版本
npm run preview # 预览构建结果
```

### 生产部署
构建后的文件位于`dist/`目录，可直接部署到静态文件服务器或CDN。

## 🤝 开发规范

- 使用TypeScript进行类型检查
- 遵循ESLint代码规范
- 组件采用函数式组件 + Hooks模式
- 使用Ant Design组件库保持UI一致性
- API调用统一通过services层处理
