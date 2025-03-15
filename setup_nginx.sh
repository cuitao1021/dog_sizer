#!/bin/bash

# 创建 Nginx 配置
sudo tee /etc/nginx/sites-available/dog_sizer > /dev/null << 'EOF'
server {
    listen 80;
    server_name 39.105.212.84;

    # 管理端
    location /admin {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 客户端
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 静态文件
    location /public {
        alias /var/www/dog_sizer/public;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

# 创建符号链接
sudo ln -sf /etc/nginx/sites-available/dog_sizer /etc/nginx/sites-enabled/

# 删除默认配置
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

echo "Nginx 配置完成！" 