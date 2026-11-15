const express = require("express");
const multer = require("multer");
const router = express.Router();
const driveService = require("../services/driveService");
const { uploadMedia } = require("../services/mediaStorageService");

// Memory storage multer for standalone drive upload endpoint
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max for photo/video
});

// Check Google Drive connection status
router.get("/status", (req, res) => {
  const status = driveService.checkAuthStatus();
  res.json({ success: true, ...status });
});

// Direct browser connect route (clean 302 redirect directly to Google consent screen)
router.get("/connect", (req, res) => {
  try {
    const url = driveService.getAuthUrl();
    res.redirect(url);
  } catch (err) {
    res.status(400).send("Configuration error: " + err.message);
  }
});

// Get Google OAuth authorization URL
router.get("/auth-url", (req, res) => {
  try {
    const url = driveService.getAuthUrl();
    res.json({ success: true, url });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Google OAuth redirect callback
router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send("Authorization code missing.");
    }
    const result = await driveService.handleOAuthCallback(code);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Drive Connected - QuickoShop</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #070e1c; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0f172a; padding: 40px; border-radius: 20px; border: 1px solid #1e293b; text-align: center; max-width: 450px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5); }
            .badge { display: inline-block; padding: 6px 14px; background: #064e3b; color: #34d399; border-radius: 9999px; font-weight: bold; font-size: 13px; margin-bottom: 16px; border: 1px solid #059669; }
            h2 { margin: 0 0 10px 0; color: #f8fafc; font-size: 22px; font-weight: 800; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
            .email { color: #38bdf8; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">✓ Google Drive Storage Active</div>
            <h2>QuickoShop Drive Connected</h2>
            <p>Your Google Drive account <span class="email">${result.userEmail || ""}</span> has been successfully linked for product & service media storage.</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 24px;">All uploaded photos and videos will now store in your Google Drive.</p>
            <p style="font-size: 11px; color: #475569;">You may safely close this window now.</p>
          </div>
          <script>setTimeout(() => { try { window.close(); } catch(e){} }, 4000);</script>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Authentication error: ${err.message}`);
  }
});

// List files currently in Google Drive
router.get("/files", async (req, res) => {
  try {
    const result = await driveService.listFilesFromDrive();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Stream file for direct preview (images / documents)
router.get("/preview/:id", async (req, res) => {
  try {
    const fileId = req.params.id;
    const meta = await driveService.getFileMetadata(fileId).catch(() => null);
    const streamRes = await driveService.getFileStream(fileId);

    const contentType =
      (meta && meta.mimeType) ||
      (streamRes.headers && streamRes.headers["content-type"]) ||
      "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(meta?.name || "media")}"`
    );
    res.setHeader("Cache-Control", "public, max-age=86400");
    streamRes.data.pipe(res);
  } catch (err) {
    console.error("[Drive Preview Error]", err.message);
    res.status(404).send("File preview unavailable");
  }
});

// Video / Audio Streaming with Range header (HTTP 206 Partial Content) for Flutter & Web video players
router.get("/stream/:id", async (req, res) => {
  try {
    const fileId = req.params.id;
    const meta = await driveService.getFileMetadata(fileId).catch(() => null);
    const totalSize = meta?.size ? parseInt(meta.size, 10) : 0;
    const mimeType = meta?.mimeType || "video/mp4";
    const range = req.headers.range;

    if (range && totalSize > 0) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      const streamRes = await driveService.getFileStream(fileId, {
        range: `bytes=${start}-${end}`,
      });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
      });

      streamRes.data.pipe(res);
    } else {
      const streamRes = await driveService.getFileStream(fileId);
      res.setHeader("Content-Type", mimeType);
      if (totalSize > 0) res.setHeader("Content-Length", totalSize);
      res.setHeader("Accept-Ranges", "bytes");
      streamRes.data.pipe(res);
    }
  } catch (err) {
    console.error("[Drive Video Stream Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Direct Download endpoint from Google Drive with attachment header
router.get("/download/:id", async (req, res) => {
  try {
    const fileId = req.params.id;
    const requestedName = req.query.name;
    const meta = await driveService.getFileMetadata(fileId).catch(() => null);
    const fileName = requestedName || meta?.name || `media-${fileId}`;
    const mimeType = meta?.mimeType || "application/octet-stream";

    const streamRes = await driveService.getFileStream(fileId);

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );
    if (meta?.size) {
      res.setHeader("Content-Length", meta.size);
    }

    streamRes.data.pipe(res);
  } catch (err) {
    console.error("[Drive Download Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Standalone media upload endpoint (supports photos & videos from Flutter & Web)
router.post("/upload", upload.array("media", 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length && req.file) {
      files.push(req.file);
    }

    if (!files.length) {
      return res.status(400).json({ success: false, message: "No media file provided." });
    }

    const folder = req.body.folder || "general";
    const uploadedResults = await Promise.all(
      files.map((file) =>
        uploadMedia({
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          folder,
        })
      )
    );

    res.status(200).json({
      success: true,
      count: uploadedResults.length,
      data: uploadedResults.length === 1 ? uploadedResults[0] : uploadedResults,
    });
  } catch (err) {
    console.error("[Drive Upload Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete file
router.delete("/:id", async (req, res) => {
  try {
    await driveService.deleteFileFromDrive(req.params.id);
    res.json({ success: true, message: "File deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
