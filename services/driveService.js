const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { google } = require("googleapis");

let cachedFolderId = null;

/**
 * Resolves path to QuickoShop tokens.json
 */
function getTokensPath() {
  const localConfigTokens = path.resolve(__dirname, "../config/drive-tokens.json");
  const localTokens = path.resolve(__dirname, "../config/tokens.json");
  const rootTokens = path.resolve(__dirname, "../tokens.json");

  if (fs.existsSync(localConfigTokens)) return localConfigTokens;
  if (fs.existsSync(localTokens)) return localTokens;
  if (fs.existsSync(rootTokens)) return rootTokens;
  return localConfigTokens;
}

/**
 * Resolves path to dedicated Google Drive Service Account (if configured)
 * NOTE: Never point to serviceAccountKey.json which belongs to Firebase Admin SDK!
 */
function getCredentialsPath() {
  const driveSaPath = path.resolve(__dirname, "../config/drive-service-account.json");
  const credsPath = path.resolve(__dirname, "../config/credentials.json");
  const rootPath = path.resolve(__dirname, "../credentials.json");

  if (fs.existsSync(driveSaPath)) return driveSaPath;
  if (fs.existsSync(credsPath)) return credsPath;
  if (fs.existsSync(rootPath)) return rootPath;
  return driveSaPath;
}

/**
 * Reads Google OAuth Web Client configuration from env or config file
 */
function getOAuthClientConfig() {
  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    "https://api.quickoshop.com/api/drive/callback";

  // Fallback to config/quickoshop-oauth.json if env vars not populated
  if (!clientId || !clientSecret) {
    const oauthJsonPath = path.resolve(__dirname, "../config/quickoshop-oauth.json");
    if (fs.existsSync(oauthJsonPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(oauthJsonPath, "utf8"));
        const client = raw.web || raw.installed || raw;
        clientId = clientId || client.client_id;
        clientSecret = clientSecret || client.client_secret;
        if (!process.env.GOOGLE_REDIRECT_URI && client.redirect_uris && client.redirect_uris[0]) {
          redirectUri = client.redirect_uris[0];
        }
      } catch (err) {
        console.warn("[Drive] Failed reading config/quickoshop-oauth.json:", err.message);
      }
    }
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Creates Service Account GoogleAuth client (if dedicated key file exists)
 */
function getServiceAccountClient() {
  const credsPath = getCredentialsPath();
  if (fs.existsSync(credsPath)) {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: credsPath,
        scopes: [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/drive",
        ],
      });
      return auth;
    } catch (e) {
      console.warn("[Drive] Service Account auth error:", e.message);
    }
  }
  return null;
}

/**
 * Creates OAuth2 client from saved tokens or config
 */
function getOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getOAuthClientConfig();

  if (!clientId || !clientSecret) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const tokensPath = getTokensPath();
  if (fs.existsSync(tokensPath)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
      oauth2Client.setCredentials(tokens);
      oauth2Client.on("tokens", (newTokens) => {
        try {
          const current = fs.existsSync(tokensPath)
            ? JSON.parse(fs.readFileSync(tokensPath, "utf8"))
            : {};
          const merged = { ...current, ...newTokens };
          fs.writeFileSync(tokensPath, JSON.stringify(merged, null, 2), "utf8");
        } catch (e) {
          console.warn("[Drive] Failed to auto-save refreshed token:", e.message);
        }
      });
      return oauth2Client;
    } catch (e) {
      console.warn("[Drive] Failed to parse tokens.json:", e.message);
    }
  }

  return oauth2Client;
}

/**
 * Generate Google OAuth consent URL
 */
function getAuthUrl() {
  const { clientId, clientSecret, redirectUri } = getOAuthClientConfig();

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in .env or config/quickoshop-oauth.json"
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });
}

/**
 * Programmatically grants 'anyone with link can view' permission
 */
async function makeItemPublic(drive, fileId) {
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
    return true;
  } catch (err) {
    console.warn(`[Drive Public Access] ${fileId}:`, err.message);
    return false;
  }
}

/**
 * Finds or creates the dedicated "QuickoShop_Media" folder in Google Drive
 */
async function getOrCreateQuickoshopFolder(drive) {
  // If explicitly configured in environment, use that
  const configuredFolder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (configuredFolder && configuredFolder.trim()) {
    return configuredFolder.trim();
  }

  // Use cached folder ID if already resolved in this process
  if (cachedFolderId) {
    return cachedFolderId;
  }

  try {
    // Search for existing QuickoShop_Media folder
    const listRes = await drive.files.list({
      q: "name = 'QuickoShop_Media' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id, name)",
      spaces: "drive",
      pageSize: 1,
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
      cachedFolderId = listRes.data.files[0].id;
      return cachedFolderId;
    }

    // Auto-create QuickoShop_Media folder in root
    const folderRes = await drive.files.create({
      requestBody: {
        name: "QuickoShop_Media",
        mimeType: "application/vnd.google-apps.folder",
        description: "Media storage folder for QuickoShop products and services",
      },
      fields: "id, name",
    });

    cachedFolderId = folderRes.data.id;
    await makeItemPublic(drive, cachedFolderId).catch(() => {});
    console.log(`[Drive] Created dedicated QuickoShop_Media folder: ${cachedFolderId}`);
    return cachedFolderId;
  } catch (err) {
    console.warn("[Drive] QuickoShop_Media folder lookup/create notice:", err.message);
    return null;
  }
}

/**
 * Handle OAuth code exchange and persist tokens
 */
async function handleOAuthCallback(code) {
  const { clientId, clientSecret, redirectUri } = getOAuthClientConfig();

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const tokensPath = getTokensPath();
  const dir = path.dirname(tokensPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), "utf8");

  let userEmail = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    userEmail = userInfo.data.email;
  } catch (err) {
    // optional email retrieval
  }

  // Initialize or verify folder
  try {
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    await getOrCreateQuickoshopFolder(drive);
  } catch (err) {
    console.warn("[Drive] Initial folder setup notice:", err.message);
  }

  console.log(`[Drive] QuickoShop Google account linked: ${userEmail || "unknown"}`);
  return { tokens, userEmail };
}

/**
 * Check whether Google Drive is authenticated
 */
function checkAuthStatus() {
  const { clientId, clientSecret } = getOAuthClientConfig();
  const tokensPath = getTokensPath();
  const credsPath = getCredentialsPath();
  const hasServiceAccount = fs.existsSync(credsPath);
  const clientIdSet = Boolean(clientId);
  const clientSecretSet = Boolean(clientSecret);
  const hasTokens = fs.existsSync(tokensPath);

  let oauthAuthenticated = false;
  let userEmail = null;

  if (hasTokens && clientIdSet && clientSecretSet) {
    try {
      const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
      oauthAuthenticated = Boolean(tokens.access_token || tokens.refresh_token);
    } catch {
      oauthAuthenticated = false;
    }
  }

  const authenticated = hasServiceAccount || oauthAuthenticated;

  return {
    oauthConfigured: clientIdSet && clientSecretSet,
    authenticated,
    type:
      hasServiceAccount && oauthAuthenticated
        ? "dual_hybrid"
        : hasServiceAccount
        ? "service_account"
        : "oauth2",
    folderId: cachedFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  };
}

/**
 * Build direct CDN / Streaming links from Drive file ID
 */
function buildDriveLinks(fileId, mimeType = "") {
  const isVideo = mimeType.startsWith("video/");
  const isImage = mimeType.startsWith("image/");

  return {
    driveId: fileId,
    // Direct Google CDN photo display (works in Flutter Image.network and Web <img> without redirects)
    directUrl: isImage
      ? `https://lh3.googleusercontent.com/d/${fileId}`
      : `https://drive.google.com/uc?export=view&id=${fileId}`,
    // Server streaming proxy (supports HTTP 206 Partial Content / Range for smooth Flutter video playback)
    streamUrl: isVideo
      ? `https://api.quickoshop.com/api/drive/stream/${fileId}`
      : `https://api.quickoshop.com/api/drive/preview/${fileId}`,
    previewUrl: `https://api.quickoshop.com/api/drive/preview/${fileId}`,
    downloadUrl: `https://api.quickoshop.com/api/drive/download/${fileId}`,
    webViewLink: `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`,
  };
}

/**
 * Upload a file buffer to Google Drive
 */
async function uploadFileToDrive(buffer, fileName, mimeType) {
  const saAuth = getServiceAccountClient();
  const oauthClient = getOAuth2Client();

  if (!saAuth && !oauthClient) {
    throw new Error(
      "QuickoShop Google Drive is not authenticated. Please link via /api/drive/auth-url"
    );
  }

  const clientsToTry = [];
  if (saAuth) clientsToTry.push({ client: saAuth, type: "service_account" });
  if (
    oauthClient &&
    oauthClient.credentials &&
    (oauthClient.credentials.access_token || oauthClient.credentials.refresh_token)
  ) {
    clientsToTry.push({ client: oauthClient, type: "oauth2" });
  }

  let lastError = null;
  for (const { client, type } of clientsToTry) {
    try {
      const drive = google.drive({ version: "v3", auth: client });
      const folderId = await getOrCreateQuickoshopFolder(drive);

      const fileMetadata = {
        name: fileName,
      };

      if (folderId) {
        fileMetadata.parents = [folderId];
      }

      const media = {
        mimeType: mimeType || "application/octet-stream",
        body: Readable.from(buffer),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields:
          "id, name, webViewLink, webContentLink, mimeType, size, createdTime, thumbnailLink",
        supportsAllDrives: true,
      });

      const fileId = response.data.id;

      // Make public so visitors and apps can view with link
      await makeItemPublic(drive, fileId);

      const links = buildDriveLinks(fileId, mimeType);

      return {
        ...response.data,
        ...links,
      };
    } catch (err) {
      console.warn(`[QuickoShop Drive Upload (${type}) Notice]:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to upload file to Google Drive");
}

/**
 * Delete a file from Google Drive
 */
async function deleteFileFromDrive(fileId) {
  const saAuth = getServiceAccountClient();
  const oauthClient = getOAuth2Client();
  const clientsToTry = [];
  if (saAuth) clientsToTry.push(saAuth);
  if (oauthClient) clientsToTry.push(oauthClient);

  let lastError = null;
  for (const client of clientsToTry) {
    try {
      const drive = google.drive({ version: "v3", auth: client });
      await drive.files.delete({ fileId });
      return true;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Google Drive not connected");
}

/**
 * List files from Google Drive
 */
async function listFilesFromDrive() {
  const saAuth = getServiceAccountClient();
  const oauthClient = getOAuth2Client();
  const clientsToTry = [];
  if (saAuth) clientsToTry.push(saAuth);
  if (oauthClient) clientsToTry.push(oauthClient);

  if (clientsToTry.length === 0) {
    return { authenticated: false, files: [] };
  }

  for (const client of clientsToTry) {
    try {
      const drive = google.drive({ version: "v3", auth: client });
      const folderId = await getOrCreateQuickoshopFolder(drive);

      let q = "trashed = false";
      if (folderId) {
        q += ` and '${folderId}' in parents`;
      }

      const response = await drive.files.list({
        q: q,
        fields:
          "files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, thumbnailLink, iconLink)",
        orderBy: "createdTime desc",
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      return {
        authenticated: true,
        files: response.data.files || [],
      };
    } catch (err) {
      console.warn("[Drive listFiles attempt failed]:", err.message);
    }
  }

  return { authenticated: false, files: [] };
}

/**
 * Stream file media from Google Drive with optional Range header support
 */
async function getFileStream(fileId, options = {}) {
  const saAuth = getServiceAccountClient();
  const oauthClient = getOAuth2Client();
  const clientsToTry = [];
  if (saAuth) clientsToTry.push(saAuth);
  if (oauthClient && oauthClient.credentials) clientsToTry.push(oauthClient);

  if (clientsToTry.length === 0) {
    throw new Error("Google Drive not connected");
  }

  let lastError = null;
  for (const client of clientsToTry) {
    try {
      const drive = google.drive({ version: "v3", auth: client });
      const requestOptions = {
        fileId,
        alt: "media",
      };

      const headers = {};
      if (options.range) {
        headers.Range = options.range;
      }

      const response = await drive.files.get(requestOptions, {
        responseType: "stream",
        headers: Object.keys(headers).length ? headers : undefined,
      });
      return response;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to stream file from Google Drive");
}

/**
 * Get file metadata from Google Drive
 */
async function getFileMetadata(fileId) {
  const saAuth = getServiceAccountClient();
  const oauthClient = getOAuth2Client();
  const clientsToTry = [];
  if (saAuth) clientsToTry.push(saAuth);
  if (oauthClient && oauthClient.credentials) clientsToTry.push(oauthClient);

  for (const client of clientsToTry) {
    try {
      const drive = google.drive({ version: "v3", auth: client });
      const response = await drive.files.get({
        fileId,
        fields: "id, name, mimeType, size, webViewLink, webContentLink",
      });
      return response.data;
    } catch (err) {
      // try next
    }
  }

  return null;
}

module.exports = {
  getAuthUrl,
  handleOAuthCallback,
  checkAuthStatus,
  uploadFileToDrive,
  deleteFileFromDrive,
  listFilesFromDrive,
  makeItemPublic,
  buildDriveLinks,
  getServiceAccountClient,
  getOAuth2Client,
  getFileStream,
  getFileMetadata,
  getOrCreateQuickoshopFolder,
};
