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
  const isGenericMime =
    !mime ||
    mime.includes("octet-stream") ||
    mime.includes("binary") ||
    mime === "application/octet-stream";

  const isKnownMediaField =
    file.fieldname === "videos" ||
    file.fieldname === "video" ||
    file.fieldname === "imgCover" ||
    file.fieldname === "images";

  // Accept if valid MIME, valid extension, generic stream, or known media field
  if (isMimeAllowed || isExtAllowed || isGenericMime || isKnownMediaField) {
    // Normalize mimetype on the file object
    if (!isMimeAllowed || isGenericMime) {
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
      else if (file.fieldname === "videos" || file.fieldname === "video") {
        file.mimetype = "video/mp4";
        if (!ext) file.originalname = `${file.originalname || "video"}.mp4`;
      } else {
        file.mimetype = "image/jpeg";
        if (!ext) file.originalname = `${file.originalname || "image"}.jpg`;
      }
    }
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are allowed for product media."));
  }
};

const uploadProductMedia = multer({
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
  uploadProductMedia,
};
