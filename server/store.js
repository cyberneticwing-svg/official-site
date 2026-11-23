const fs = require("fs");
const path = require("path");
const config = require("./config");

const ROOT = path.join(__dirname, "..");
const DATA_FILE = path.join(__dirname, "data", "store.json");
const PUBLIC_DATA_FILE = path.join(ROOT, "data", "site.json");

function normalizeStore(data) {
  if (!data || typeof data !== "object") data = {};
  if (!Array.isArray(data.clients)) data.clients = [];
  if (!Array.isArray(data.team)) data.team = [];
  if (!Array.isArray(data.services)) data.services = [];
  if (!data.settings || typeof data.settings !== "object") {
    data.settings = { showClients: true };
  }
  if (typeof data.settings.showClients !== "boolean") {
    data.settings.showClients = true;
  }
  if (!data.contact || typeof data.contact !== "object") data.contact = {};
  if (!data.social || typeof data.social !== "object") data.social = {};
  return data;
}

function readStoreFromDisk() {
  const file = fs.existsSync(DATA_FILE) ? DATA_FILE : PUBLIC_DATA_FILE;
  return normalizeStore(JSON.parse(fs.readFileSync(file, "utf8")));
}

function writeStoreToDisk(data) {
  const json = JSON.stringify(data, null, 2);
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.mkdirSync(path.dirname(PUBLIC_DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, json, "utf8");
  fs.writeFileSync(PUBLIC_DATA_FILE, json, "utf8");
}

function githubEnabled() {
  return Boolean(config.githubToken && config.githubRepo);
}

async function githubRequest(pathname, options = {}) {
  const url = `https://api.github.com/repos/${config.githubRepo}${pathname}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cybernetics-wings-admin",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.message || `GitHub API error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function githubGetFile(filePath) {
  const encoded = filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  try {
    return await githubRequest(`/contents/${encoded}?ref=${encodeURIComponent(config.githubBranch)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function githubPutFile(filePath, contentBufferOrString, message) {
  const existing = await githubGetFile(filePath);
  const content =
    typeof contentBufferOrString === "string"
      ? Buffer.from(contentBufferOrString, "utf8").toString("base64")
      : Buffer.from(contentBufferOrString).toString("base64");

  const encoded = filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  return githubRequest(`/contents/${encoded}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content,
      branch: config.githubBranch,
      ...(existing?.sha ? { sha: existing.sha } : {}),
    }),
  });
}

async function readStoreFromGitHub() {
  const file = await githubGetFile("server/data/store.json");
  if (!file?.content) {
    const publicFile = await githubGetFile("data/site.json");
    if (!publicFile?.content) return readStoreFromDisk();
    const raw = Buffer.from(publicFile.content, "base64").toString("utf8");
    return normalizeStore(JSON.parse(raw));
  }
  const raw = Buffer.from(file.content, "base64").toString("utf8");
  return normalizeStore(JSON.parse(raw));
}

async function writeStoreToGitHub(data) {
  const json = JSON.stringify(data, null, 2);
  const message = `Admin update: site content (${new Date().toISOString()})`;
  await githubPutFile("server/data/store.json", json, message);
  await githubPutFile("data/site.json", json, `Admin update: public site data (${new Date().toISOString()})`);
}

async function readStore() {
  if (config.isVercel && githubEnabled()) {
    try {
      return await readStoreFromGitHub();
    } catch (err) {
      console.error("GitHub read failed, falling back to disk:", err.message);
      return readStoreFromDisk();
    }
  }
  return readStoreFromDisk();
}

async function writeStore(data) {
  const normalized = normalizeStore(data);
  if (config.isVercel) {
    if (!githubEnabled()) {
      throw new Error(
        "Vercel admin saves need GITHUB_TOKEN. Add it in Vercel → Project → Settings → Environment Variables."
      );
    }
    await writeStoreToGitHub(normalized);
    return normalized;
  }
  writeStoreToDisk(normalized);
  return normalized;
}

async function saveUpload(relativePath, buffer) {
  const clean = relativePath.replace(/^\/+/, "");
  if (config.isVercel) {
    if (!githubEnabled()) {
      throw new Error(
        "Image uploads on Vercel need GITHUB_TOKEN. Add it in Vercel → Project → Settings → Environment Variables."
      );
    }
    await githubPutFile(clean, buffer, `Admin upload: ${clean}`);
    return `/${clean}`;
  }
  const full = path.join(ROOT, clean);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
  return `/${clean}`;
}

async function deleteUpload(relativePath) {
  if (!relativePath) return;
  const clean = relativePath.replace(/^\/+/, "");
  if (config.isVercel) {
    // Leave old images in the repo; avoiding destructive deletes for safety.
    return;
  }
  const full = path.join(ROOT, clean);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

module.exports = {
  ROOT,
  DATA_FILE,
  readStore,
  writeStore,
  saveUpload,
  deleteUpload,
  githubEnabled,
};
