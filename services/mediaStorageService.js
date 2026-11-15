const fs = require("fs");
const path = require("path");
const driveService = require("./driveService");

const getExtensionFromMime = (mimeType = "") => {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.startsWith("video/")) return "mp4";
  return "bin";
};

/**
 * Universal media uploader for products and services
 * Prioritizes QuickoShop Google Drive cloud storage
 * Falls back safely to local disk (/uploads/) if Google Drive is pending authentication
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

  // 1. Try Google Drive first
  const driveStatus = driveService.checkAuthStatus();
  if (driveStatus.authenticated) {
    try {
      const driveFile = await driveService.uploadFileToDrive(buffer, fileName, mime);
      console.log(`[MediaStorage] Uploaded to Google Drive: ${driveFile.name} (ID: ${driveFile.id})`);
      
      const isVideo = mime.startsWith("video/");
      // For images: direct CDN link (no redirect). For videos: stream proxy.
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
    } catch (driveErr) {
      console.warn("[MediaStorage] Google Drive upload failed, falling back to local storage:", driveErr.message);
    }
  }

  // 2. Safe local storage fallback (/uploads/<folder>/<filename>)
  const uploadsDir = path.resolve(__dirname, "../uploads", folder);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const localFilePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(localFilePath, buffer);

  const localUrl = `https://api.quickoshop.com/uploads/${folder}/${fileName}`;
  console.log(`[MediaStorage] Saved locally: ${localUrl}`);

  return {
    url: localUrl,
    directUrl: localUrl,
    streamUrl: localUrl,
    source: "local_disk",
    mimeType: mime,
    name: fileName,
  };
};

module.exports = {
  uploadMedia,
  getExtensionFromMime,
};
