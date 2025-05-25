# 配置说明

## 环境变量配置

如需自定义配置，可以创建 `.env` 文件：

```bash
# 数据库配置
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=rag_evaluation

# 后端配置
DATABASE_URL=postgresql://postgres:postgres@database:5432/rag_evaluation
POSTGRES_SERVER=database

# 前端配置
REACT_APP_API_URL=http://localhost:8000
```

## 端口配置

如果默认端口有冲突，可以修改 `docker-compose.yml` 中的端口映射：

```yaml
# 前端Web服务
caddy:
  ports:
    - "8080:80"    # HTTP端口改为8080
    - "8443:443"   # HTTPS端口改为8443

# 后端API服务
backend:
  ports:
    - "8001:8000"  # API端口改为8001

# 数据库服务
database:
  ports:
    - "5433:5432"  # 数据库端口改为5433
```

## 域名配置

### 开发环境（默认）
默认配置使用 `localhost`，无需额外配置。

### 生产环境
1. 编辑 `Caddyfile`
2. 取消注释域名配置部分：
   ```caddyfile
   your-domain.com {
       # ... 配置内容
   }
   ```
3. 替换 `your-domain.com` 为你的实际域名
4. 重启服务：`docker-compose restart caddy`

## 数据持久化

数据库数据默认持久化保存在Docker卷中：
- 卷名：`rag-eval-postgres-data`
- 查看：`docker volume ls`
- 备份：`docker run --rm -v rag-eval-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .`

## 日志配置

Caddy日志保存在：
- 容器内路径：`/var/log/caddy/access.log`
- 查看日志：`docker-compose logs caddy`

## 开发模式配置

后端默认启用开发模式（热重载），如需禁用：

```yaml
backend:
  command: uvicorn app.main:app --host 0.0.0.0 --port 8000  # 移除 --reload
``` 