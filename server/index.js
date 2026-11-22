const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const config = require("./config");

const app = express();
const ROOT = path.join(__dirname, "..");
const DATA_FILE = path.join(__dirname, "data", "store.json");
const TEAM_UPLOAD_DIR = path.join(ROOT, "uploads", "team");
const CLIENT_UPLOAD_DIR = path.join(ROOT, "uploads", "clients");

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(TEAM_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(CLIENT_UPLOAD_DIR, { recursive: true });

const sessions = new Map();

function readStore() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (!Array.isArray(data.clients)) data.clients = [];
  if (!Array.isArray(data.team)) data.team = [];
  if (!Array.isArray(data.services)) data.services = [];
  if (!data.settings || typeof data.settings !== "object") {
    data.settings = { showClients: true };
  }
  if (typeof data.settings.showClients !== "boolean") {
    data.settings.showClients = true;
  }
  return data;
}

function writeStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function authRequired(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  next();
}

function makeUploader(destDir) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, destDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
        cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) {
        return cb(new Error("Only image uploads are allowed"));
      }
      cb(null, true);
    },
  });
}

const uploadTeam = makeUploader(TEAM_UPLOAD_DIR);
const uploadClient = makeUploader(CLIENT_UPLOAD_DIR);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${new Date().toLocaleString()} ${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// ——— Public API ———
app.get("/api/site", (_req, res) => {
  res.json(readStore());
});

app.get("/api/contact", (_req, res) => {
  res.json(readStore().contact);
});

app.get("/api/social", (_req, res) => {
  res.json(readStore().social);
});

app.get("/api/services", (_req, res) => {
  res.json(readStore().services);
});

app.get("/api/team", (_req, res) => {
  res.json(readStore().team);
});

app.get("/api/clients", (_req, res) => {
  res.json(readStore().clients);
});

// ——— Auth ———
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === config.adminUsername && password === config.adminPassword) {
    const token = uuidv4();
    sessions.set(token, { createdAt: Date.now() });
    return res.json({ token, username });
  }
  return res.status(401).json({ error: "Invalid username or password" });
});

app.post("/api/admin/logout", authRequired, (req, res) => {
  sessions.delete(req.headers["x-admin-token"]);
  res.json({ ok: true });
});

app.get("/api/admin/me", authRequired, (_req, res) => {
  res.json({ username: config.adminUsername });
});

// ——— Contact ———
app.put("/api/admin/contact", authRequired, (req, res) => {
  const store = readStore();
  store.contact = { ...store.contact, ...req.body };
  writeStore(store);
  res.json(store.contact);
});

// ——— Social ———
app.put("/api/admin/social", authRequired, (req, res) => {
  const store = readStore();
  store.social = { ...store.social, ...req.body };
  writeStore(store);
  res.json(store.social);
});

app.put("/api/admin/settings", authRequired, (req, res) => {
  const store = readStore();
  const raw = req.body?.showClients;
  const showClients = raw === true || raw === "true" || raw === 1 || raw === "1";
  store.settings = {
    ...store.settings,
    showClients,
  };
  writeStore(store);
  res.json(store.settings);
});

// ——— Services ———
app.post("/api/admin/services", authRequired, (req, res) => {
  const store = readStore();
  const item = {
    id: (req.body.id || uuidv4()).toString().trim().toLowerCase().replace(/\s+/g, "-"),
    title: req.body.title || "New Service",
    subtitle: req.body.subtitle || "",
    description: req.body.description || "",
    features: normalizeList(req.body.features),
    benefits: normalizeList(req.body.benefits),
    idealFor: req.body.idealFor || "",
    cta: req.body.cta || "Enquire Now",
  };
  if (store.services.some((s) => s.id === item.id)) {
    return res.status(400).json({ error: "A service with this ID already exists" });
  }
  store.services.push(item);
  writeStore(store);
  res.status(201).json(item);
});

app.put("/api/admin/services/:id", authRequired, (req, res) => {
  const store = readStore();
  const idx = store.services.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Service not found" });

  store.services[idx] = {
    ...store.services[idx],
    title: req.body.title ?? store.services[idx].title,
    subtitle: req.body.subtitle ?? store.services[idx].subtitle,
    description: req.body.description ?? store.services[idx].description,
    features: req.body.features !== undefined ? normalizeList(req.body.features) : store.services[idx].features,
    benefits: req.body.benefits !== undefined ? normalizeList(req.body.benefits) : store.services[idx].benefits,
    idealFor: req.body.idealFor ?? store.services[idx].idealFor,
    cta: req.body.cta ?? store.services[idx].cta,
  };
  writeStore(store);
  res.json(store.services[idx]);
});

app.delete("/api/admin/services/:id", authRequired, (req, res) => {
  const store = readStore();
  const before = store.services.length;
  store.services = store.services.filter((s) => s.id !== req.params.id);
  if (store.services.length === before) {
    return res.status(404).json({ error: "Service not found" });
  }
  writeStore(store);
  res.json({ ok: true });
});

// ——— Team ———
app.post("/api/admin/team", authRequired, uploadTeam.single("photo"), (req, res) => {
  const store = readStore();
  const item = {
    id: uuidv4(),
    name: req.body.name || "Team Member",
    role: req.body.role || "",
    bio: req.body.bio || "",
    photo: req.file ? `/uploads/team/${req.file.filename}` : "",
    isLead: req.body.isLead === "true" || req.body.isLead === true,
  };
  store.team.push(item);
  writeStore(store);
  res.status(201).json(item);
});

app.put("/api/admin/team/:id", authRequired, uploadTeam.single("photo"), (req, res) => {
  const store = readStore();
  const idx = store.team.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Team member not found" });

  const current = store.team[idx];
  if (req.file && current.photo) {
    const oldPath = path.join(ROOT, current.photo.replace(/^\//, ""));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  store.team[idx] = {
    ...current,
    name: req.body.name ?? current.name,
    role: req.body.role ?? current.role,
    bio: req.body.bio ?? current.bio,
    isLead: req.body.isLead !== undefined ? req.body.isLead === "true" || req.body.isLead === true : current.isLead,
    photo: req.file ? `/uploads/team/${req.file.filename}` : current.photo,
  };
  writeStore(store);
  res.json(store.team[idx]);
});

app.delete("/api/admin/team/:id", authRequired, (req, res) => {
  const store = readStore();
  const member = store.team.find((t) => t.id === req.params.id);
  if (!member) return res.status(404).json({ error: "Team member not found" });

  if (member.photo) {
    const oldPath = path.join(ROOT, member.photo.replace(/^\//, ""));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  store.team = store.team.filter((t) => t.id !== req.params.id);
  writeStore(store);
  res.json({ ok: true });
});

// ——— Clients ———
app.post("/api/admin/clients", authRequired, uploadClient.single("logo"), (req, res) => {
  const store = readStore();
  const item = {
    id: uuidv4(),
    name: req.body.name || "Client",
    industry: req.body.industry || "",
    description: req.body.description || "",
    website: req.body.website || "",
    logo: req.file ? `/uploads/clients/${req.file.filename}` : "",
  };
  store.clients.push(item);
  writeStore(store);
  res.status(201).json(item);
});

app.put("/api/admin/clients/:id", authRequired, uploadClient.single("logo"), (req, res) => {
  const store = readStore();
  const idx = store.clients.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Client not found" });

  const current = store.clients[idx];
  if (req.file && current.logo) {
    const oldPath = path.join(ROOT, current.logo.replace(/^\//, ""));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  store.clients[idx] = {
    ...current,
    name: req.body.name ?? current.name,
    industry: req.body.industry ?? current.industry,
    description: req.body.description ?? current.description,
    website: req.body.website ?? current.website,
    logo: req.file ? `/uploads/clients/${req.file.filename}` : current.logo,
  };
  writeStore(store);
  res.json(store.clients[idx]);
});

app.delete("/api/admin/clients/:id", authRequired, (req, res) => {
  const store = readStore();
  const client = store.clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: "Client not found" });

  if (client.logo) {
    const oldPath = path.join(ROOT, client.logo.replace(/^\//, ""));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  store.clients = store.clients.filter((c) => c.id !== req.params.id);
  writeStore(store);
  res.json({ ok: true });
});

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Request failed" });
});

app.use("/uploads", express.static(path.join(ROOT, "uploads")));
app.use("/admin", express.static(path.join(ROOT, "admin")));

// Serve HTML pages with or without .html (e.g. /contact and /contact.html)
app.use(express.static(ROOT, { extensions: ["html"] }));

const htmlPages = {
  "/": "index.html",
  "/about": "about.html",
  "/services": "services.html",
  "/contact": "contact.html",
};

Object.entries(htmlPages).forEach(([route, file]) => {
  app.get([route, `${route}/`.replace("//", "/")], (_req, res) => {
    res.sendFile(path.join(ROOT, file));
  });
});

app.get(["/admin", "/admin/"], (_req, res) => {
  res.sendFile(path.join(ROOT, "admin", "index.html"));
});

app.listen(config.port, () => {
  console.log(`Cybernetics Wings running at http://localhost:${config.port}`);
  console.log(`Admin dashboard: http://localhost:${config.port}/admin`);
  console.log(`Login: ${config.adminUsername} / ${config.adminPassword}`);
});
