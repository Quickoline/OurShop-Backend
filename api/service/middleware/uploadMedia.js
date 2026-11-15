const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype?.startsWith("image/") || file.mimetype?.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are allowed for service media."));
  }
};

const uploadServiceMedia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for high-quality photos and videos
  },
}).fields([
  { name: "imgCover", maxCount: 1 },
  { name: "images", maxCount: 12 },
  { name: "videos", maxCount: 4 },
  { name: "video", maxCount: 1 },
]);

module.exports = {
  uploadServiceMedia,
};
