const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype?.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed for product media."));
  }
};

const uploadProductMedia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).fields([
  { name: "imgCover", maxCount: 1 },
  { name: "images", maxCount: 8 },
]);

module.exports = {
  uploadProductMedia,
};
