const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');  // 需要先安装: npm install sharp

const app = express();

// 启用跨域和JSON解析
app.use(cors());
app.use(express.json());

// 设置静态文件服务，将 public 目录作为网站根目录
app.use(express.static(path.join(__dirname, '../public')));

// 设置各种图片目录的静态文件服务
app.use('/icons', express.static(path.join(__dirname, '../public/icons')));
app.use('/brand-icons', express.static(path.join(__dirname, '../public/brand-icons')));
app.use('/product-images', express.static(path.join(__dirname, '../public/product-images')));

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/icons'))
  },
  filename: function (req, file, cb) {
    // 临时文件名，实际保存时会重命名
    cb(null, `temp_${Date.now()}${path.extname(file.originalname)}`)
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 只允许上传图片
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('只允许上传图片文件！'), false);
    }
    cb(null, true);
  }
});

// 品牌图标上传配置
const brandIconStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/brand-icons'))
  },
  filename: function (req, file, cb) {
    cb(null, `temp_${Date.now()}${path.extname(file.originalname)}`)
  }
});

// 产品图片上传配置
const productImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/product-images'))
  },
  filename: function (req, file, cb) {
    cb(null, `temp_${Date.now()}${path.extname(file.originalname)}`)
  }
});

const uploadBrandIcon = multer({ storage: brandIconStorage });
const uploadProductImage = multer({ storage: productImageStorage });

// 配置内容图片上传
const dogCardImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 确保目录存在
    const uploadDir = path.join(__dirname, '../public/uploads');
    const compressedDir = path.join(__dirname, '../public/uploads/compressed');
    fs.mkdir(uploadDir, { recursive: true })
      .then(() => fs.mkdir(compressedDir, { recursive: true }))
      .then(() => cb(null, uploadDir))
      .catch(err => cb(err));
  },
  filename: function (req, file, cb) {
    cb(null, `temp_${Date.now()}${path.extname(file.originalname)}`)
  }
});

const uploadDogCardImage = multer({ storage: dogCardImageStorage });

// 设置上传目录的静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// API路由

// 获取狗狗类型列表
app.get('/api/dog-types', async (req, res) => {
  try {
    const data = await fs.readFile(
      path.join(__dirname, '../data/dogTypes.json'), 
      'utf8'
    );
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('获取狗狗类型列表失败:', error);
    res.status(500).json({ error: '获取狗狗类型列表失败' });
  }
});

// 创建新的狗狗类型
app.post('/api/dog-types', upload.single('icon'), async (req, res) => {
  try {
    // 验证文件上传
    if (!req.file) {
      return res.status(400).json({ error: '请上传狗狗图标' });
    }

    // 验证必要字段
    if (!req.body.name || !req.body.nameEn) {
      return res.status(400).json({ error: '请提供完整的狗狗信息' });
    }

    // 读取现有数据
    const data = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/dogTypes.json'), 'utf8')
    );

    // 生成新ID
    const newId = String(Number(data.lastId) + 1);
    const newFilename = `${newId}.png`;
    
    // 重命名上传的文件
    await fs.rename(
      req.file.path,
      path.join(__dirname, '../public/icons', newFilename)
    );

    // 创建新的狗狗类型数据
    const newDogType = {
      id: newId,
      name: req.body.name,
      nameEn: req.body.nameEn,
      icon: `/icons/${newFilename}`
    };

    // 更新数据
    data.dogTypes.push(newDogType);
    data.lastId = newId;

    // 保存到文件
    await fs.writeFile(
      path.join(__dirname, '../data/dogTypes.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );

    // 返回新创建的数据
    res.json(newDogType);
  } catch (error) {
    console.error('创建狗狗类型失败:', error);
    res.status(500).json({ error: '创建狗狗类型失败' });
  }
});

// 更新狗狗类型
app.put('/api/dog-types/:id', upload.single('icon'), async (req, res) => {
    try {
        const oldId = req.params.id;
        const { id, name, nameEn } = req.body;

        // 验证必要字段
        if (!id || !name || !nameEn) {
            return res.status(400).json({ error: '请提供完整的狗狗信息' });
        }

        // 读取现有数据
        const data = JSON.parse(
            await fs.readFile(path.join(__dirname, '../data/dogTypes.json'), 'utf8')
        );

        // 检查新ID是否与其他记录重复
        if (id !== oldId && data.dogTypes.some(dog => dog.id === id)) {
            return res.status(400).json({ error: 'ID已存在' });
        }

        // 找到要更新的记录
        const dogIndex = data.dogTypes.findIndex(dog => dog.id === oldId);
        if (dogIndex === -1) {
            return res.status(404).json({ error: '未找到指定的狗狗类型' });
        }

        // 处理图片更新
        let iconPath = data.dogTypes[dogIndex].icon;
        if (req.file) {
            const newFilename = `${id}.png`;
            try {
                await fs.rename(
                    req.file.path,
                    path.join(__dirname, '../public/icons', newFilename)
                );
                iconPath = `/icons/${newFilename}`;

                // 如果ID改变了，需要删除旧图片
                if (id !== oldId) {
                    const oldIconPath = path.join(__dirname, '../public/icons', `${oldId}.png`);
                    try {
                        await fs.unlink(oldIconPath);
                    } catch (error) {
                        console.warn('删除旧图片失败:', error);
                    }
                }
            } catch (error) {
                console.error('保存图片失败:', error);
                return res.status(500).json({ error: '保存图片失败' });
            }
        } else if (id !== oldId) {
            // 如果ID改变但没有上传新图片，重命名现有图片
            const oldIconPath = path.join(__dirname, '../public/icons', `${oldId}.png`);
            const newIconPath = path.join(__dirname, '../public/icons', `${id}.png`);
            try {
                await fs.rename(oldIconPath, newIconPath);
                iconPath = `/icons/${id}.png`;
            } catch (error) {
                console.error('重命名图片失败:', error);
                return res.status(500).json({ error: '重命名图片失败' });
            }
        }

        // 更新数据
        data.dogTypes[dogIndex] = {
            id,
            name,
            nameEn,
            icon: iconPath
        };

        // 保存到文件
        await fs.writeFile(
            path.join(__dirname, '../data/dogTypes.json'),
            JSON.stringify(data, null, 2),
            'utf8'
        );

        res.json(data.dogTypes[dogIndex]);
    } catch (error) {
        console.error('更新狗狗类型失败:', error);
        res.status(500).json({ error: '更新狗狗类型失败' });
    }
});

// 删除狗狗类型
app.delete('/api/dog-types/:id', async (req, res) => {
    try {
        const dogId = req.params.id;
        
        // 读取现有数据
        const data = JSON.parse(
            await fs.readFile(path.join(__dirname, '../data/dogTypes.json'), 'utf8')
        );
        
        // 找到要删除的记录
        const dogIndex = data.dogTypes.findIndex(dog => dog.id === dogId);
        if (dogIndex === -1) {
            return res.status(404).json({ error: '未找到指定的狗狗类型' });
        }
        
        // 删除图片文件
        const iconPath = path.join(__dirname, '../public/icons', `${dogId}.png`);
        try {
            await fs.unlink(iconPath);
        } catch (error) {
            console.warn('删除图片文件失败:', error);
        }
        
        // 从数组中删除数据
        data.dogTypes.splice(dogIndex, 1);
        
        // 保存更新后的数据
        await fs.writeFile(
            path.join(__dirname, '../data/dogTypes.json'),
            JSON.stringify(data, null, 2),
            'utf8'
        );
        
        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('删除狗狗类型失败:', error);
        res.status(500).json({ error: '删除狗狗类型失败' });
    }
});

// 品牌相关API
app.get('/api/brands', async (req, res) => {
  try {
    const data = await fs.readFile(path.join(__dirname, '../data/brands.json'), 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: '获取品牌列表失败' });
  }
});

app.post('/api/brands', uploadBrandIcon.single('icon'), async (req, res) => {
  try {
    // 验证文件上传
    if (!req.file) {
      return res.status(400).json({ error: '请上传品牌图标' });
    }

    // 验证必要字段
    if (!req.body.name || !req.body.nameEn || !req.body.description) {
      return res.status(400).json({ error: '请提供完整的品牌信息' });
    }

    // 读取现有数据
    const data = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/brands.json'), 'utf8')
    );

    // 生成新ID
    const newId = String(Number(data.lastId) + 1);
    const newFilename = `${newId}.png`;
    
    // 重命名上传的文件
    await fs.rename(
      req.file.path,
      path.join(__dirname, '../public/brand-icons', newFilename)
    );

    // 创建新的品牌数据
    const newBrand = {
      id: newId,
      name: req.body.name,
      nameEn: req.body.nameEn,
      description: req.body.description,
      icon: `/brand-icons/${newFilename}`
    };

    // 更新数据
    data.brands.push(newBrand);
    data.lastId = newId;

    // 保存到文件
    await fs.writeFile(
      path.join(__dirname, '../data/brands.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );

    // 返回新创建的数据
    res.json(newBrand);
  } catch (error) {
    console.error('创建品牌失败:', error);
    res.status(500).json({ error: '创建品牌失败' });
  }
});

app.put('/api/brands/:id', uploadBrandIcon.single('icon'), async (req, res) => {
  try {
    const oldId = req.params.id;
    const { id, name, nameEn, description } = req.body;

    // 验证必要字段
    if (!id || !name || !nameEn || !description) {
      return res.status(400).json({ error: '请提供完整的品牌信息' });
    }

    // 读取现有数据
    const data = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/brands.json'), 'utf8')
    );

    // 检查新ID是否与其他记录重复
    if (id !== oldId && data.brands.some(brand => brand.id === id)) {
      return res.status(400).json({ error: 'ID已存在' });
    }

    // 找到要更新的记录
    const brandIndex = data.brands.findIndex(brand => brand.id === oldId);
    if (brandIndex === -1) {
      return res.status(404).json({ error: '未找到指定的品牌' });
    }

    // 处理图片更新
    let iconPath = data.brands[brandIndex].icon;
    if (req.file) {
      const newFilename = `${id}.png`;
      await fs.rename(
        req.file.path,
        path.join(__dirname, '../public/brand-icons', newFilename)
      );
      iconPath = `/brand-icons/${newFilename}`;

      // 如果ID改变了，需要删除旧图片
      if (id !== oldId) {
        const oldIconPath = path.join(__dirname, '../public/brand-icons', `${oldId}.png`);
        try {
          await fs.unlink(oldIconPath);
        } catch (error) {
          console.warn('删除旧图片失败:', error);
        }
      }
    } else if (id !== oldId) {
      // 如果ID改变但没有上传新图片，重命名现有图片
      const oldIconPath = path.join(__dirname, '../public/brand-icons', `${oldId}.png`);
      const newIconPath = path.join(__dirname, '../public/brand-icons', `${id}.png`);
      await fs.rename(oldIconPath, newIconPath);
      iconPath = `/brand-icons/${id}.png`;
    }

    // 更新数据
    data.brands[brandIndex] = {
      id,
      name,
      nameEn,
      description,
      icon: iconPath
    };

    // 保存到文件
    await fs.writeFile(
      path.join(__dirname, '../data/brands.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );

    res.json(data.brands[brandIndex]);
  } catch (error) {
    console.error('更新品牌失败:', error);
    res.status(500).json({ error: '更新品牌失败' });
  }
});

app.delete('/api/brands/:id', async (req, res) => {
  try {
    const brandId = req.params.id;
    
    // 读取现有数据
    const data = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/brands.json'), 'utf8')
    );
    
    // 找到要删除的记录
    const brandIndex = data.brands.findIndex(brand => brand.id === brandId);
    if (brandIndex === -1) {
      return res.status(404).json({ error: '未找到指定的品牌' });
    }
    
    // 删除图片文件
    const iconPath = path.join(__dirname, '../public/brand-icons', `${brandId}.png`);
    try {
      await fs.unlink(iconPath);
    } catch (error) {
      console.warn('删除图片文件失败:', error);
    }
    
    // 从数组中删除数据
    data.brands.splice(brandIndex, 1);
    
    // 保存更新后的数据
    await fs.writeFile(
      path.join(__dirname, '../data/brands.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除品牌失败:', error);
    res.status(500).json({ error: '删除品牌失败' });
  }
});

// 产品相关API
app.get('/api/products', async (req, res) => {
  try {
    const data = await fs.readFile(path.join(__dirname, '../data/products.json'), 'utf8');
    const products = JSON.parse(data);
    // 确保返回的格式与前端期望的一致
    res.json({ products: products.products });
  } catch (error) {
    res.status(500).json({ error: '获取产品列表失败' });
  }
});

app.post('/api/products', uploadProductImage.single('image'), async (req, res) => {
  try {
    // 验证必要字段
    if (!req.body.name || !req.body.brandId) {
      return res.status(400).json({ error: '请提供完整的产品信息' });
    }

    // 验证品牌是否存在
    const brandsData = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/brands.json'), 'utf8')
    );
    
    if (!brandsData.brands.some(brand => brand.id === req.body.brandId)) {
      return res.status(400).json({ error: '选择的品牌不存在' });
    }

    // 读取现有数据
    const data = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/products.json'), 'utf8')
    );

    // 生成新ID
    const newId = String(Number(data.lastId) + 1);

    // 创建新的产品数据
    const newProduct = {
      id: newId,
      name: req.body.name,
      brandId: req.body.brandId
    };

    // 更新数据
    data.products.push(newProduct);
    data.lastId = newId;

    // 保存到文件
    await fs.writeFile(
      path.join(__dirname, '../data/products.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );

    // 返回新创建的数据
    res.json(newProduct);
  } catch (error) {
    console.error('创建产品失败:', error);
    res.status(500).json({ error: '创建产品失败' });
  }
});

app.put('/api/products/:id', uploadProductImage.single('image'), async (req, res) => {
  try {
    const oldId = req.params.id;
    const { id, name, brandId } = req.body;

    // 验证必要字段
    if (!id || !name || !brandId) {
      return res.status(400).json({ error: '请提供完整的产品信息' });
    }

    // 验证品牌是否存在
    const brandsData = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/brands.json'), 'utf8')
    );
    
    if (!brandsData.brands.some(brand => brand.id === brandId)) {
      return res.status(400).json({ error: '选择的品牌不存在' });
    }

    // 读取现有数据
    const data = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/products.json'), 'utf8')
    );

    // 检查新ID是否与其他记录重复
    if (id !== oldId && data.products.some(product => product.id === id)) {
      return res.status(400).json({ error: 'ID已存在' });
    }

    // 找到要更新的记录
    const productIndex = data.products.findIndex(product => product.id === oldId);
    if (productIndex === -1) {
      return res.status(404).json({ error: '未找到指定的产品' });
    }

    // 更新数据
    data.products[productIndex] = {
      id,
      name,
      brandId
    };

    // 保存到文件
    await fs.writeFile(
      path.join(__dirname, '../data/products.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );

    res.json(data.products[productIndex]);
  } catch (error) {
    console.error('更新产品失败:', error);
    res.status(500).json({ error: '更新产品失败' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    // 读取现有数据
    const data = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/products.json'), 'utf8')
    );
    
    // 找到要删除的记录
    const productIndex = data.products.findIndex(product => product.id === productId);
    if (productIndex === -1) {
      return res.status(404).json({ error: '未找到指定的产品' });
    }
    
    // 从数组中删除数据
    data.products.splice(productIndex, 1);
    
    // 保存更新后的数据
    await fs.writeFile(
      path.join(__dirname, '../data/products.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除产品失败:', error);
    res.status(500).json({ error: '删除产品失败' });
  }
});

// 内容管理相关API
app.get('/api/dog-cards', async (req, res) => {
  try {
    const data = await fs.readFile(path.join(__dirname, '../data/dogCards.json'), 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('获取内容列表失败:', error);
    res.status(500).json({ error: '获取内容列表失败' });
  }
});

app.post('/api/dog-cards', uploadDogCardImage.single('image'), async (req, res) => {
  try {
    // 验证必要字段
    const { dogTypeId, productId, size } = req.body;
    if (!dogTypeId || !productId || !size) {
      return res.status(400).json({ error: '请提供完整的信息' });
    }

    // 读取现有数据
    const data = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/dogCards.json'), 'utf8')
    );

    // 生成新ID
    const newId = `card${data.dogCards.length + 1}`;
    let imagePath = '';
    let newFilename = '';
    
    // 如果上传了新图片，处理图片
    if (req.file) {
      newFilename = `${newId}${path.extname(req.file.originalname)}`;
      const compressedFilename = `${newId}_compressed.jpg`;
      const uploadDir = path.join(__dirname, '../public/uploads');
      const compressedDir = path.join(__dirname, '../public/uploads/compressed');
      
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.mkdir(compressedDir, { recursive: true });

      // 保存原始图片
      await fs.rename(
        req.file.path,
        path.join(uploadDir, newFilename)
      );

      // 创建压缩版本
      await sharp(path.join(uploadDir, newFilename))
        .resize(800, 800, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 80,
          progressive: true
        })
        .toFile(path.join(compressedDir, compressedFilename));

      // 使用压缩后的图片路径
      imagePath = `/uploads/compressed/${compressedFilename}`;
    }

    // 创建新的内容数据
    const newDogCard = {
      id: newId,
      image: imagePath,
      originalImage: newFilename ? `/uploads/${newFilename}` : '',
      dogTypeId,
      measurements: {
        neck: req.body.neck ? parseFloat(req.body.neck) : null,
        chest: req.body.chest ? parseFloat(req.body.chest) : null,
        back: req.body.back ? parseFloat(req.body.back) : null
      },
      product: {
        productId,
        size
      }
    };

    // 更新数据
    data.dogCards.push(newDogCard);

    // 保存到文件
    await fs.writeFile(
      path.join(__dirname, '../data/dogCards.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );

    // 返回新创建的数据
    res.json(newDogCard);
  } catch (error) {
    console.error('创建内容失败:', error);
    // 如果上传的文件存在，尝试删除它
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('临时文件删除失败:', unlinkError);
      }
    }
    res.status(500).json({ 
      error: '创建内容失败',
      details: error.message 
    });
  }
});

app.put('/api/dog-cards/:id', uploadDogCardImage.single('image'), async (req, res) => {
  try {
    const cardId = req.params.id;
    const { dogTypeId, productId, size, neck, chest, back } = req.body;

    // 验证必要字段
    if (!dogTypeId || !productId || !size || !neck || !chest || !back) {
      return res.status(400).json({ error: '请提供完整的信息' });
    }

    // 验证狗狗品种是否存在
    const dogTypesData = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/dogTypes.json'), 'utf8')
    );
    if (!dogTypesData.dogTypes.some(dog => dog.id === dogTypeId)) {
      return res.status(400).json({ error: '选择的狗狗品种不存在' });
    }

    // 验证产品是否存在
    const productsData = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/products.json'), 'utf8')
    );
    if (!productsData.products.some(product => product.id === productId)) {
      return res.status(400).json({ error: '选择的产品不存在' });
    }

    // 读取现有数据
    const data = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/dogCards.json'), 'utf8')
    );

    // 找到要更新的记录
    const cardIndex = data.dogCards.findIndex(card => card.id === cardId);
    if (cardIndex === -1) {
      return res.status(404).json({ error: '未找到指定的内容' });
    }

    // 处理图片更新
    let imagePath = data.dogCards[cardIndex].image;
    if (req.file) {
      const newFilename = `${cardId}${path.extname(req.file.originalname)}`;
      await fs.rename(
        req.file.path,
        path.join(__dirname, '../public/uploads', newFilename)
      );
      imagePath = `/uploads/${newFilename}`;
    }

    // 更新数据
    data.dogCards[cardIndex] = {
      id: cardId,
      image: imagePath,
      dogTypeId,
      measurements: {
        neck: parseFloat(neck),
        chest: parseFloat(chest),
        back: parseFloat(back)
      },
      product: {
        productId,
        size
      }
    };

    // 保存到文件
    await fs.writeFile(
      path.join(__dirname, '../data/dogCards.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );

    res.json(data.dogCards[cardIndex]);
  } catch (error) {
    console.error('更新内容失败:', error);
    res.status(500).json({ error: '更新内容失败' });
  }
});

app.delete('/api/dog-cards/:id', async (req, res) => {
  try {
    const cardId = req.params.id;
    
    // 读取现有数据
    const data = JSON.parse(
      await fs.readFile(path.join(__dirname, '../data/dogCards.json'), 'utf8')
    );
    
    // 找到要删除的记录
    const cardIndex = data.dogCards.findIndex(card => card.id === cardId);
    if (cardIndex === -1) {
      return res.status(404).json({ error: '未找到指定的内容' });
    }
    
    // 删除图片文件
    const imagePath = path.join(__dirname, '../public', data.dogCards[cardIndex].image);
    try {
      await fs.unlink(imagePath);
    } catch (error) {
      console.warn('删除图片文件失败:', error);
    }
    
    // 从数组中删除数据
    data.dogCards.splice(cardIndex, 1);
    
    // 保存更新后的数据
    await fs.writeFile(
      path.join(__dirname, '../data/dogCards.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除内容失败:', error);
    res.status(500).json({ error: '删除内容失败' });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`请访问 http://localhost:${PORT} 使用管理系统`);
}); 