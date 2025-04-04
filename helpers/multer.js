const storage = require('multer').diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads/re-image"));
  },
  filename:(req,file,cb)=>{
    cb(null,Date.now()+"-"+file.originalname);
  }
})

module.exports = storage;

