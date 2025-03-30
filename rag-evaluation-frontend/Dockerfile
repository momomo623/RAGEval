# 多阶段构建 - 第一阶段：构建应用
FROM node:18-alpine AS builder

WORKDIR /app

# 设置 npm 镜像源为 npmmirror
RUN npm config set registry http://registry.npmmirror.com/

# 复制依赖文件
COPY package.json package-lock.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .
# 构建应用
RUN npm run build

# 第二阶段：使用nginx提供静态文件
FROM nginx:alpine

# 复制nginx配置文件
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

# 从builder阶段复制构建产物到nginx目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露80端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"] 
