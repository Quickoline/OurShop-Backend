const path = require("path");
const driveService = require("./driveService");

const getExtensionFromMime = (mimeType = "", originalName = "") => {
  const mime = (mimeType || "").toLowerCase();
  const ext = path.extname(originalName || "").toLowerCase().replace(/^\./, "");
  if (ext) return ext;

  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("matroska") || mime.includes("mkv")) return "mkv";
  if (mime.startsWith("video/")) return "mp4";
  return "bin";
};

/**
 * Universal media uploader for products and services
 * Uploads exclusively to QuickoShop Google Drive
 */
const uploadMedia = async ({ buffer, originalname, mimetype, folder = "products" }) => {
  if (!buffer || !buffer.length) {
    throw new Error("Empty buffer provided for media upload.");
  }

  let mime = (mimetype || "").toLowerCase();
  const original = (originalname || "").toLowerCase();

  // Normalize generic or octet-stream MIME types from filename extension
  if (!mime || mime === "application/octet-stream" || mime === "binary/octet-stream") {
    if (original.endsWith(".mp4") || original.endsWith(".m4v")) mime = "video/mp4";
    else if (original.endsWith(".mov")) mime = "video/quicktime";
    else if (original.endsWith(".mkv")) mime = "video/x-matroska";
    else if (original.endsWith(".webm")) mime = "video/webm";
    else if (original.endsWith(".avi")) mime = "video/x-msvideo";
    else if (original.endsWith(".3gp")) mime = "video/3gpp";
    else if (original.endsWith(".jpg") || original.endsWith(".jpeg")) mime = "image/jpeg";
    else if (original.endsWith(".png")) mime = "image/png";
    else if (original.endsWith(".webp")) mime = "image/webp";
    else if (original.endsWith(".gif")) mime = "image/gif";
    else mime = "application/octet-stream";
  }

  const ext = getExtensionFromMime(mime, originalname);
  const cleanOriginalName = (originalname || `media-${Date.now()}.${ext}`)
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${cleanOriginalName}`;

  // Upload exclusively to Google Drive
  const driveFile = await driveService.uploadFileToDrive(buffer, fileName, mime);
  console.log(`[GoogleDrive] Uploaded media: ${driveFile.name} (ID: ${driveFile.id}, mime: ${mime})`);

  const isVideo = mime.startsWith("video/") || mime === "application/mp4" || mime === "application/x-matroska";
  // For images: direct Google CDN link. For videos: HTTP 206 streaming proxy.
  const publicUrl = isVideo ? driveFile.streamUrl : driveFile.directUrl;

  return {
    url: publicUrl,
    directUrl: driveFile.directUrl,
    streamUrl: driveFile.streamUrl,
    previewUrl: driveFile.previewUrl,
    downloadUrl: driveFile.downloadUrl,
    webViewLink: driveFile.webViewLink,
    driveId: driveFile.id,
    source: "google_drive",
    mimeType: mime,
    name: driveFile.name,
  };
};

module.exports = {
  uploadMedia,
  getExtensionFromMime,
};
