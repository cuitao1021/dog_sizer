const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// 启用跨域
app.use(cors());

// 设置静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 设置后台图片资源的访问
app.use('/icons', express.static(path.join(__dirname, '../public/icons')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/brand-icons', express.static(path.join(__dirname, '../public/brand-icons')));
app.use('/product-images', express.static(path.join(__dirname, '../public/product-images')));

// 启动服务器
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`用户前台运行在 http://localhost:${PORT}`);
}); 