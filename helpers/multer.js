// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadPath = path.join(__dirname, '../../public/uploads/re-image');

//     fs.mkdir(uploadPath, { recursive: true }, (err) => {
//       if (err) return cb(err);
//       cb(null, uploadPath);
//     });
//   },
//   filename: (req, file, cb) => {
//     const sanitizedName = file.originalname.replace(/\s+/g, '-');
//     cb(null, Date.now() + '-' + sanitizedName);
//   }
// });

// const upload = multer({ storage });

// module.exports = upload;

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/product-images');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const uploads = multer({ storage: storage });

module.exports = uploads;
