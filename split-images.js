const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function splitFurnitureImages() {
  const inputImage = '4x4_furniture_image.png';
  const outputDir = 'frontend/public/furniture';
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Get image dimensions
  const { width, height } = await sharp(inputImage).metadata();
  
  // Calculate individual image dimensions (1/4 of original)
  const itemWidth = Math.floor(width / 4);
  const itemHeight = Math.floor(height / 4);
  
  console.log(`Original image: ${width}x${height}`);
  console.log(`Each item: ${itemWidth}x${itemHeight}`);
  
  // Split into 16 individual images (4x4 grid)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const index = row * 4 + col;
      const left = col * itemWidth;
      const top = row * itemHeight;
      
      const outputPath = path.join(outputDir, `furniture_${index}.png`);
      
      await sharp(inputImage)
        .extract({
          left: left,
          top: top,
          width: itemWidth,
          height: itemHeight
        })
        .png()
        .toFile(outputPath);
        
      console.log(`Created: ${outputPath} (${left},${top} ${itemWidth}x${itemHeight})`);
    }
  }
  
  console.log('✅ Successfully split image into 16 individual furniture images!');
}

splitFurnitureImages().catch(console.error); 