const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { google } = require("googleapis");

/**
 * Resolves path to tokens.json
 */
function getTokensPath() {
  const localConfigPath = path.resolve(__dirname, "../config/tokens.json");
  const rootPath = path.resolve(__dirname, "../tokens.json");
  const gdrivePath = path.resolve(__dirname, "../../Gdrive/tokens.json");
  const rbharatPath = path.resolve(__dirname, "../../../root/Rbharat-Backend/tokens.json");
  
  if (fs.existsSync(localConfigPath)) return localConfigPath;
  if (fs.existsSync(rootPath)) return rootPath;
  if (fs.existsSync(gdrivePath)) return gdrivePath;
  if (fs.existsSync(rbharatPath)) return rbharatPath;
  return localConfigPath;
}

/**
 * Resolves path to service account credentials.json
 */
function getCredentialsPath() {
  const localCredsPath = path.resolve(__dirname, "../config/credentials.json");
  const localServiceAccount = path.resolve(__dirname, "../config/serviceAccountKey.json");
  const rootPath = path.resolve(__dirname, "../credentials.json");
  const gdrivePath = path.resolve(__dirname, "../../Gdrive/credentials.json");
  const rbharatPath = path.resolve(__dirname, "../../../root/Rbharat-Backend/credentials.json");

  if (fs.existsSync(localCredsPath)) return localCredsPath;
  if (fs.existsSync(localServiceAccount)) return localServiceAccount;
  if (fs.existsSync(rootPath)) return rootPath;
  if (fs.existsSync(gdrivePath)) return gdrivePath;
  if (fs.existsSync(rbharatPath)) return rbharatPath;
  return localCredsPath;
}

/**
 * Creates Service Account GoogleAuth client
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
      console.warn("[Drive] Failed to load credentials keyFile:", e.message);
    }
  }
  return null;
}

/**
 * Creates OAuth2 client from tokens.json or environment variables
 */
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    "https://api.quickoshop.com/api/drive/callback";

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
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    "https://api.quickoshop.com/api/drive/callback";

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in .env"
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
 * Handle OAuth code exchange and persist tokens
 */
async function handleOAuthCallback(code) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    "https://api.quickoshop.com/api/drive/callback";

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

  return { tokens, userEmail };
}

/**
 * Check whether Google Drive is authenticated
 */
function checkAuthStatus() {
  const tokensPath = getTokensPath();
  const credsPath = getCredentialsPath();
  const hasServiceAccount = fs.existsSync(credsPath);
  const clientIdSet = Boolean(process.env.GOOGLE_CLIENT_ID);
  const clientSecretSet = Boolean(process.env.GOOGLE_CLIENT_SECRET);
  const hasTokens = fs.existsSync(tokensPath);

  let oauthAuthenticated = false;
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
    oauthConfigured: (clientIdSet && clientSecretSet) || hasServiceAccount,
    authenticated,
    type:
      hasServiceAccount && oauthAuthenticated
        ? "dual_hybrid"
        : hasServiceAccount
        ? "service_account"
        : "oauth2",
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  };
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
 * Upload a file buffer to Google Drive (Dual-Hybrid: Service Account + OAuth2 fallback)
 */
async function uploadFileToDrive(buffer, fileName, mimeType) {
  const saAuth = getServiceAccountClient();
  const oauthClient = getOAuth2Client();

  if (!saAuth && !oauthClient) {
    throw new Error(
      "Google Drive is not authenticated. Please configure credentials.json or tokens.json."
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
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      const fileMetadata = {
        name: fileName,
      };

      if (folderId) {
        fileMetadata.parents = [folderId];
        makeItemPublic(drive, folderId).catch(() => {});
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
      console.warn(`[Drive Upload (${type}) Notice]:`, err.message);
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

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  let q = "trashed = false";
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }

  for (const client of clientsToTry) {
    try {
      const drive = google.drive({ version: "v3", auth: client });
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
};
