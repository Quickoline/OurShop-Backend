const driveService = require("./driveService");

const getExtensionFromMime = (mimeType = "") => {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("matroska") || mimeType.includes("mkv")) return "mkv";
  if (mimeType.startsWith("video/")) return "mp4";
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

  const mime = mimetype || "application/octet-stream";
  const ext = getExtensionFromMime(mime);
  const cleanOriginalName = (originalname || `media-${Date.now()}.${ext}`)
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${cleanOriginalName}`;

  // Upload exclusively to Google Drive
  const driveFile = await driveService.uploadFileToDrive(buffer, fileName, mime);
  console.log(`[GoogleDrive] Uploaded media: ${driveFile.name} (ID: ${driveFile.id}, mime: ${mime})`);

  const isVideo = mime.startsWith("video/");
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
