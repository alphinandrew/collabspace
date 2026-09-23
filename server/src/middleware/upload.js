const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const tempDir = path.join(config.storage.localDir, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'upload-' + uniqueSuffix + ext);
  }
});

// File filter rejecting directly dangerous binary executables
const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.vbs', '.ps1', '.scr', '.pif'];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (dangerousExtensions.includes(ext)) {
    return cb(new Error(`File type ${ext} is restricted for security reasons.`), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxFileSizeMb * 1024 * 1024,
  },
  fileFilter,
});

module.exports = upload;
