#!/bin/bash

# 进入项目目录
cd /var/www/dog_sizer

# 创建必要的目录
mkdir -p public/icons
mkdir -p public/brand-icons
mkdir -p public/product-images
mkdir -p public/uploads/compressed
mkdir -p data

# 设置目录权限
chmod -R 755 public
chmod -R 755 data

# 拉取最新代码
git pull

# 停止并删除旧容器
docker-compose down

# 重新构建和启动容器
docker-compose up -d --build

# 检查容器状态
docker-compose ps 