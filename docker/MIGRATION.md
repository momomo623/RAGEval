# Docker配置迁移总结

## 迁移概述

将 `docker_https` 文件夹的配置迁移到 `docker` 文件夹，使其适合GitHub开源项目使用。

## 主要变更

### 1. 服务架构优化
- **Web服务器**: nginx → Caddy
- **SSL管理**: 手动证书/certbot → Caddy自动管理
- **配置复杂度**: 大幅简化，无需额外脚本

### 2. 域名配置调整
- **默认配置**: 支持localhost访问
- **生产配置**: 可选的自定义域名配置
- **用户友好**: 注释清晰，易于理解和修改

### 3. 部署简化
- **启动方式**: `docker-compose up -d` 一键启动
- **无需脚本**: 移除所有shell脚本依赖
- **开箱即用**: 默认配置即可运行

## 文件对比

### docker_https/ (服务器专用)
```
docker_https/
├── docker-compose.yml    # 包含特定域名配置
├── Dockerfile.backend    
├── Dockerfile.caddy      
├── Caddyfile            # 硬编码域名
├── build.sh             # 构建脚本
├── deploy.sh            # 部署脚本
├── test-api.sh          # 测试脚本
└── 其他文档...
```

### docker/ (GitHub开源)
```
docker/
├── docker-compose.yml    # 通用配置
├── Dockerfile.backend    
├── Dockerfile.caddy      
├── Caddyfile            # localhost + 可选域名
├── README.md            # 使用说明
├── CONFIGURATION.md     # 配置说明
└── sql.sql              # 数据库初始化
```

## 配置差异

### Caddyfile
**docker_https版本**:
```caddyfile
rag-eval.chongwenz.cn {
    # 硬编码特定域名
}
```

**docker版本**:
```caddyfile
localhost {
    # 默认localhost配置
}

# your-domain.com {
#     # 可选的自定义域名配置（注释状态）
# }
```

### docker-compose.yml
**主要变更**:
- 移除 `version` 属性（避免警告）
- 服务名统一：`db` → `database`
- 构建上下文优化
- 卷路径修正

## 使用方式

### 开发环境
```bash
cd docker
docker-compose up -d
# 访问: http://localhost
```

### 生产环境
1. 编辑 `Caddyfile`，启用域名配置
2. 替换为实际域名
3. 启动服务

## 优势

1. **简化部署**: 无需复杂脚本，一条命令启动
2. **用户友好**: 默认配置即可使用，降低使用门槛
3. **灵活配置**: 支持开发和生产环境
4. **文档完善**: 详细的使用和配置说明
5. **开源友好**: 适合GitHub项目分发

## 兼容性

- ✅ 保持所有原有功能
- ✅ 支持自定义域名
- ✅ 支持SSL自动管理
- ✅ 支持开发模式热重载
- ✅ 数据持久化保存 