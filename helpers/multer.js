const fs = require('fs');
const multer = require('multer');
const path = require('path');

function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    cb(new Error(`Invalid file type. Only ${ALLOWED_FILE_TYPES.join(', ')} are allowed.`), false);
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads');
  },
  filename: function (req, file, cb) {
    console.log("File name:", file.originalname);
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + getRandomNumber(0,10) + ext);
  }
});

// Use fields instead of array to handle multiple fields with array-like naming
const uploads = multer({ 
  storage: storage, 
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  } 
});


module.exports = {
  array: uploads.array.bind(uploads),
  fields: uploads.fields.bind(uploads),
  getRandomNumber: getRandomNumber
};