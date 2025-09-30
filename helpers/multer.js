const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = "products"; // folder name in Cloudinary
    return {
      folder: folder,
      format: file.mimetype.split("/")[1], // jpg, png, webp
      public_id: Date.now() + "-" + file.originalname.split(".")[0],
    };
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type."), false);
  }
};

const uploads = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});


function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}
module.exports = {
  array: uploads.array.bind(uploads),
  fields: uploads.fields.bind(uploads),
  getRandomNumber
};