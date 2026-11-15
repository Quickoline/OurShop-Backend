const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

// Allowed image and video extensions (covers mobile picker formats on Android & iOS)
const ALLOWED_MEDIA_REGEX = /\.(jpg|jpeg|png|webp|gif|bmp|svg|mp4|mov|mkv|webm|avi|m4v|3gp|flv)$/i;

const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || "").toLowerCase();
  const ext = path.extname(file.originalname || "").toLowerCase();

  const isMimeAllowed =
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime === "application/mp4" ||
    mime === "application/x-matroska" ||
    mime === "application/quicktime";

  const isExtAllowed = ALLOWED_MEDIA_REGEX.test(file.originalname || "");

  // Accept if valid MIME or valid extension (crucial for Android/Flutter which often sends application/octet-stream)
  if (isMimeAllowed || isExtAllowed || mime === "application/octet-stream") {
    // Normalize mimetype on the file object
    if (!isMimeAllowed || mime === "application/octet-stream") {
      if (ext === ".mp4" || ext === ".m4v") file.mimetype = "video/mp4";
      else if (ext === ".mov") file.mimetype = "video/quicktime";
      else if (ext === ".mkv") file.mimetype = "video/x-matroska";
      else if (ext === ".webm") file.mimetype = "video/webm";
      else if (ext === ".avi") file.mimetype = "video/x-msvideo";
      else if (ext === ".3gp") file.mimetype = "video/3gpp";
      else if (ext === ".jpg" || ext === ".jpeg") file.mimetype = "image/jpeg";
      else if (ext === ".png") file.mimetype = "image/png";
      else if (ext === ".webp") file.mimetype = "image/webp";
      else if (ext === ".gif") file.mimetype = "image/gif";
    }
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
