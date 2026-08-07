// server/utils/imageValidator.js
const path = require('path');
const fs = require('fs');
const constants = require('../config/constants');

const validateImageContent = (filePath) => {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { start: 0, end: 4 });
    let buffers = [];
    
    stream.on('data', chunk => buffers.push(chunk));
    
    stream.on('end', () => {
      const buffer = Buffer.concat(buffers);
      const hex = buffer.toString('hex').toLowerCase();
      
      // Check JPEG
      if (hex.startsWith('ffd8ff')) {
        return resolve({ valid: true, mimeType: 'image/jpeg' });
      }
      
      // Check PNG
      if (hex.startsWith('89504e47')) {
        return resolve({ valid: true, mimeType: 'image/png' });
      }
      
      // Check GIF
      if (hex.startsWith('47494638')) {
        return resolve({ valid: true, mimeType: 'image/gif' });
      }
      
      // Check WEBP (RIFF....WEBP)
      if (hex.startsWith('52494646') && hex.includes('57454250')) {
        return resolve({ valid: true, mimeType: 'image/webp' });
      }
      
      reject(new Error('Invalid image content. File type not supported.'));
    });
    
    stream.on('error', err => reject(err));
  });
};

const sanitizeFilename = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  if (!validExts.includes(ext)) {
    throw new Error('Invalid file extension');
  }
  
  // Generate safe filename: timestamp-random.ext
  const safeName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
  return safeName;
};

const validateImage = async (file) => {
  // 1. Check MIME type from multer
  if (!constants.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new Error(`File type ${file.mimetype} not allowed`);
  }
  
  // 2. Check file size
  if (file.size > constants.MAX_FILE_SIZE) {
    throw new Error(`File too large. Max size is ${constants.MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  // 3. Validate actual content (magic numbers)
  await validateImageContent(file.path);
  
  // 4. Sanitize filename
  const safeName = sanitizeFilename(file.originalname);
  
  return { valid: true, safeName, mimeType: file.mimetype };
};

module.exports = {
  validateImage,
  sanitizeFilename,
  validateImageContent
};
