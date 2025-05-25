# RAG评估系统 - Docker部署

## 快速启动

```bash
# 克隆项目
git clone https://github.com/momomo623/RAGEval.git
cd RAGEval

# 启动所有服务
cd docker
docker-compose up -d
```

## 访问地址

- **前端应用**: http://localhost
- **后端API**: http://localhost:8000
- **数据库**: localhost:5432

## 服务说明

### 🗄️ 数据库 (PostgreSQL)
- 容器名: `rag-eval-db`
- 端口: 5432
- 用户名: `postgres`
- 密码: `postgres`
- 数据库: `rag_evaluation`

### 🚀 后端 (FastAPI)
- 容器名: `rag-eval-backend`
- 端口: 8000
- 自动重载开发模式
- API文档: http://localhost:8000/docs

### 🌐 前端 (React + Caddy)
- 容器名: `rag-eval-caddy`
- 端口: 80 (HTTP), 443 (HTTPS)
- 自动构建前端应用
- 反向代理API请求

## 自定义域名配置

如需在生产环境使用自定义域名：

1. 编辑 `Caddyfile`
2. 取消注释域名配置部分
3. 替换 `your-domain.com` 为你的域名
4. 重启服务：`docker-compose restart caddy`

Caddy会自动获取和管理SSL证书。

## 常用命令

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重建并启动
docker-compose up -d --build

# 查看服务状态
docker-compose ps
```

## 故障排除

### 端口冲突
如果80端口被占用，可以修改docker-compose.yml中的端口映射：
```yaml
ports:
  - "8080:80"  # 使用8080端口访问
```

### 数据库连接问题
确保数据库服务健康检查通过：
```bash
docker-compose logs database
```

### 前端构建失败
检查前端依赖是否正确安装：
```bash
docker-compose logs caddy
```

## 开发模式

项目默认以开发模式运行：
- 后端支持热重载
- 前端代码变更需要重新构建镜像
- 数据库数据持久化保存 