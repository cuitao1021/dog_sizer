const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

async function compressExistingImages() {
  const uploadsDir = path.join(__dirname, '../public/uploads');
  const compressedDir = path.join(__dirname, '../public/uploads/compressed');
  
  try {
    const files = await fs.readdir(uploadsDir);
    console.log(`Found ${files.length} files to process`);
    
    for (const file of files) {
      if (file.match(/\.(jpg|jpeg|png|gif)$/)) {
        const filePath = path.join(uploadsDir, file);
        const compressedPath = path.join(compressedDir, `${path.parse(file).name}_compressed.jpg`);
        
        console.log(`Processing: ${file}`);
        
        await sharp(filePath)
          .resize(800, 800, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 80,
            progressive: true
          })
          .toFile(compressedPath);
        
        console.log(`Compressed: ${file}`);
      }
    }
    
    console.log('All images have been compressed');
  } catch (error) {
    console.error('Error compressing images:', error);
  }
}

compressExistingImages(); 