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

const driveMigrationService = require("../services/driveMigrationService");

// Migration Status JSON
router.get("/migrate-s3/status", async (req, res) => {
  try {
    const stats = await driveMigrationService.getMigrationStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Trigger S3 to Google Drive Migration
router.post("/migrate-s3", async (req, res) => {
  try {
    const result = await driveMigrationService.startMigration();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Rollback to S3
router.post("/migrate-s3/rollback", async (req, res) => {
  try {
    const result = await driveMigrationService.rollbackMigration();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Migration Visual Dashboard (Admin friendly web UI)
router.get("/migrate-dashboard", async (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>QuickoShop Media Migration | S3 -> Google Drive</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1120; color: #f8fafc; margin: 0; padding: 40px 20px; }
        .container { max-width: 800px; margin: 0 auto; background: #131d32; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 20px; margin-bottom: 24px; }
        .header h1 { font-size: 22px; margin: 0; display: flex; align-items: center; gap: 10px; }
        .badge { background: #064e3b; color: #34d399; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; border: 1px solid #059669; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
        .stat-title { font-size: 13px; color: #94a3b8; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-value { font-size: 28px; font-weight: 800; color: #fff; }
        .stat-card.s3 .stat-value { color: #f59e0b; }
        .stat-card.gdrive .stat-value { color: #38bdf8; }
        .progress-box { background: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #1e293b; }
        .progress-bar-bg { background: #1e293b; height: 12px; border-radius: 6px; overflow: hidden; margin: 12px 0 8px 0; }
        .progress-bar-fill { background: linear-gradient(90deg, #38bdf8, #3b82f6); height: 100%; width: 0%; transition: width 0.3s ease; }
        .progress-meta { display: flex; justify-content: space-between; font-size: 13px; color: #94a3b8; }
        .current-item { font-size: 13px; color: #cbd5e1; margin-top: 8px; font-style: italic; min-height: 18px; }
        .actions { display: flex; gap: 12px; margin-bottom: 24px; }
        .btn { padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; }
        .btn-primary { background: #2563eb; color: #fff; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-danger { background: transparent; color: #ef4444; border: 1px solid #ef4444; }
        .btn-danger:hover { background: #ef444422; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .logs-box { background: #090e1a; border-radius: 12px; padding: 16px; border: 1px solid #1e293b; max-height: 220px; overflow-y: auto; font-family: monospace; font-size: 12px; color: #cbd5e1; }
        .logs-box div { margin-bottom: 4px; }
        .note { font-size: 12px; color: #64748b; margin-top: 20px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚡ QuickoShop S3 ➔ Google Drive Migration</h1>
          <span class="badge" id="authBadge">Drive Connected</span>
        </div>

        <div class="stats-grid">
          <div class="stat-card s3">
            <div class="stat-title">Remaining on S3</div>
            <div class="stat-value" id="s3Count">...</div>
          </div>
          <div class="stat-card gdrive">
            <div class="stat-title">Stored on Google Drive</div>
            <div class="stat-value" id="gdriveCount">...</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Total Catalog Media</div>
            <div class="stat-value" id="totalCount">...</div>
          </div>
        </div>

        <div class="progress-box">
          <div class="progress-meta">
            <span id="statusLabel">Status: Ready</span>
            <span id="percentLabel">0%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="progressBar"></div>
          </div>
          <div class="current-item" id="currentItem">No active migration</div>
        </div>

        <div class="actions">
          <button class="btn btn-primary" id="startBtn" onclick="startMigration()">Start Migration to Google Drive</button>
          <button class="btn btn-danger" id="rollbackBtn" onclick="rollbackMigration()">Rollback to S3</button>
        </div>

        <div class="logs-box" id="logsBox">
          <div>Waiting for user action...</div>
        </div>

        <div class="note">
          🔒 <b>Safety Guarantee:</b> Original S3 URLs are safely backed up in MongoDB (field <code>s3BackupUrl</code>). You can rollback anytime. New files and migrated files immediately serve via Google CDN with zero app disruption.
        </div>
      </div>

      <script>
        let pollTimer = null;

        async function fetchStats() {
          try {
            const res = await fetch("/api/drive/migrate-s3/status");
            const data = await res.json();
            if (!data.success) return;

            document.getElementById("s3Count").textContent = data.totalS3Remaining;
            document.getElementById("gdriveCount").textContent = data.gdriveProducts + data.gdriveServices;
            document.getElementById("totalCount").textContent = data.totalProducts + data.totalServices;

            const job = data.job;
            const startBtn = document.getElementById("startBtn");

            if (job.running) {
              startBtn.disabled = true;
              startBtn.textContent = "Migrating in Progress...";
              const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
              document.getElementById("statusLabel").textContent = "Processing: " + job.processed + " / " + job.total;
              document.getElementById("percentLabel").textContent = pct + "%";
              document.getElementById("progressBar").style.width = pct + "%";
              document.getElementById("currentItem").textContent = job.currentItem || "Processing...";
            } else {
              startBtn.disabled = data.totalS3Remaining === 0;
              startBtn.textContent = data.totalS3Remaining === 0 ? "All Media Migrated!" : "Start Migration to Google Drive";
              if (job.completedAt) {
                document.getElementById("statusLabel").textContent = "Status: Completed (" + job.success + " migrated)";
                document.getElementById("progressBar").style.width = "100%";
                document.getElementById("percentLabel").textContent = "100%";
                document.getElementById("currentItem").textContent = "Migration completed successfully.";
              }
            }

            if (job.logs && job.logs.length) {
              const logsBox = document.getElementById("logsBox");
              logsBox.innerHTML = job.logs.map(l => "<div>" + l + "</div>").join("");
            }
          } catch (e) {
            console.error("Failed fetching status", e);
          }
        }

        async function startMigration() {
          if (!confirm("Start migrating all remaining S3 photos to Google Drive now?")) return;
          try {
            const res = await fetch("/api/drive/migrate-s3", { method: "POST" });
            const data = await res.json();
            alert(data.message);
            fetchStats();
          } catch (e) {
            alert("Error: " + e.message);
          }
        }

        async function rollbackMigration() {
          if (!confirm("Are you sure you want to revert all Google Drive URLs back to their original S3 URLs?")) return;
          try {
            const res = await fetch("/api/drive/migrate-s3/rollback", { method: "POST" });
            const data = await res.json();
            alert(data.message);
            fetchStats();
          } catch (e) {
            alert("Error: " + e.message);
          }
        }

        fetchStats();
        setInterval(fetchStats, 2000);
      </script>
    </body>
    </html>
  `);
});

module.exports = router;
