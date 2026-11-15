const Product = require("../api/product/model/model");
const Service = require("../api/service/model/model");
const driveService = require("./driveService");

let activeJob = {
  running: false,
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  currentItem: null,
  startedAt: null,
  completedAt: null,
  error: null,
  logs: [],
};

function addLog(msg) {
  const time = new Date().toLocaleTimeString();
  activeJob.logs.unshift(`[${time}] ${msg}`);
  if (activeJob.logs.length > 100) activeJob.logs.pop();
  console.log(`[DriveMigration] ${msg}`);
}

async function getMigrationStats() {
  const totalProducts = await Product.countDocuments();
  const s3Products = await Product.countDocuments({
    imgCover: { $regex: /s3\.|amazonaws\.com/i },
  });
  const gdriveProducts = await Product.countDocuments({
    imgCover: { $regex: /googleusercontent\.com|drive\.google\.com/i },
  });

  const totalServices = await Service.countDocuments();
  const s3Services = await Service.countDocuments({
    imgCover: { $regex: /s3\.|amazonaws\.com/i },
  });
  const gdriveServices = await Service.countDocuments({
    imgCover: { $regex: /googleusercontent\.com|drive\.google\.com/i },
  });

  return {
    totalProducts,
    s3Products,
    gdriveProducts,
    totalServices,
    s3Services,
    gdriveServices,
    totalS3Remaining: s3Products + s3Services,
    job: activeJob,
  };
}

async function downloadUrlToBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} downloading ${url}`);
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const arrayBuf = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuf),
    contentType,
  };
}

async function startMigration() {
  if (activeJob.running) {
    return { success: false, message: "Migration is already in progress." };
  }

  // Find all items with S3 links
  const products = await Product.find({
    imgCover: { $regex: /s3\.|amazonaws\.com/i },
  });
  const services = await Service.find({
    imgCover: { $regex: /s3\.|amazonaws\.com/i },
  });

  const totalItems = products.length + services.length;
  if (totalItems === 0) {
    return { success: true, message: "No S3 media found to migrate. All media already in Google Drive!" };
  }

  activeJob = {
    running: true,
    total: totalItems,
    processed: 0,
    success: 0,
    failed: 0,
    currentItem: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    logs: [],
  };

  addLog(`Starting migration of ${totalItems} items (${products.length} products, ${services.length} services) to Google Drive...`);

  // Run in background asynchronously so request returns immediately
  (async () => {
    try {
      // 1. Migrate Products
      for (const prod of products) {
        activeJob.currentItem = `Product: ${prod.name}`;
        try {
          const originalS3Url = prod.imgCover;
          const { buffer, contentType } = await downloadUrlToBuffer(originalS3Url);
          const fileName = `prod-${prod._id}-${Date.now()}.jpg`;

          const driveRes = await driveService.uploadFileToDrive(buffer, fileName, contentType);
          const newDriveUrl = driveRes.directUrl || driveRes.url;

          // Safe non-destructive update: save original S3 link in backup field
          prod.s3BackupUrl = originalS3Url;
          prod.imgCover = newDriveUrl;
          await prod.save();

          activeJob.success++;
          addLog(`✓ Migrated Product: "${prod.name}" -> Google Drive (${driveRes.id})`);
        } catch (err) {
          activeJob.failed++;
          addLog(`✗ Failed Product: "${prod.name}" - ${err.message}`);
        }
        activeJob.processed++;
      }

      // 2. Migrate Services
      for (const srv of services) {
        activeJob.currentItem = `Service: ${srv.name}`;
        try {
          const originalS3Url = srv.imgCover;
          const { buffer, contentType } = await downloadUrlToBuffer(originalS3Url);
          const fileName = `srv-${srv._id}-${Date.now()}.jpg`;

          const driveRes = await driveService.uploadFileToDrive(buffer, fileName, contentType);
          const newDriveUrl = driveRes.directUrl || driveRes.url;

          srv.s3BackupUrl = originalS3Url;
          srv.imgCover = newDriveUrl;
          await srv.save();

          activeJob.success++;
          addLog(`✓ Migrated Service: "${srv.name}" -> Google Drive (${driveRes.id})`);
        } catch (err) {
          activeJob.failed++;
          addLog(`✗ Failed Service: "${srv.name}" - ${err.message}`);
        }
        activeJob.processed++;
      }

      activeJob.completedAt = new Date().toISOString();
      activeJob.running = false;
      activeJob.currentItem = null;
      addLog(`🎉 Migration completed! Success: ${activeJob.success}, Failed: ${activeJob.failed}`);
    } catch (err) {
      activeJob.running = false;
      activeJob.error = err.message;
      addLog(`FATAL ERROR: ${err.message}`);
    }
  })().catch((err) => {
    activeJob.running = false;
    activeJob.error = err.message;
  });

  return {
    success: true,
    message: `Migration started in background for ${totalItems} items.`,
    total: totalItems,
  };
}

async function rollbackMigration() {
  const products = await Product.find({ s3BackupUrl: { $exists: true, $ne: null } });
  const services = await Service.find({ s3BackupUrl: { $exists: true, $ne: null } });

  let restored = 0;
  for (const prod of products) {
    prod.imgCover = prod.s3BackupUrl;
    prod.s3BackupUrl = null;
    await prod.save();
    restored++;
  }
  for (const srv of services) {
    srv.imgCover = srv.s3BackupUrl;
    srv.s3BackupUrl = null;
    await srv.save();
    restored++;
  }

  return {
    success: true,
    restored,
    message: `Rollback complete. Restored ${restored} items to their original S3 URLs.`,
  };
}

module.exports = {
  getMigrationStats,
  startMigration,
  rollbackMigration,
};
