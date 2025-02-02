import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Ensure the temp directory exists
const tempDir = process.env.UPLOAD_PATH;
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir); // Store files in the temp directory
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`); //generate unique fileName
  },
});

export const upload = multer({
  storage,
});
