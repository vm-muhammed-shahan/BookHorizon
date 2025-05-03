const fs = require('fs');
const multer = require('multer');
const path = require('path');

function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

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

const uploads = multer({ storage: storage });

module.exports = uploads;
