const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const config = require("./config");
const { createAdminToken, authRequired } = require("./auth");
const { ROOT, readStore, writeStore, saveUpload, deleteUpload } = require("./store");

const app = express();
const TEAM_UPLOAD_DIR = path.join(ROOT, "uploads", "team");
const CLIENT_UPLOAD_DIR = path.join(ROOT, "uploads", "clients");

if (!config.isVercel) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
  fs.mkdirSync(TEAM_UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(CLIENT_UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
});

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function fileExt(file) {
  const fromName = path.extname(file.originalname || "").toLowerCase();
  if (fromName) return fromName;
  if (file.mimetype === "image/png") return ".png";
  if (file.mimetype === "image/webp") return ".webp";
  if (file.mimetype === "image/gif") return ".gif";
  return ".jpg";
}

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
app.get(
  "/api/site",
  asyncHandler(async (_req, res) => {
    res.json(await readStore());
  })
);

app.get(
  "/api/contact",
  asyncHandler(async (_req, res) => {
    res.json((await readStore()).contact);
  })
);

app.get(
  "/api/social",
  asyncHandler(async (_req, res) => {
    res.json((await readStore()).social);
  })
);

app.get(
  "/api/services",
  asyncHandler(async (_req, res) => {
    res.json((await readStore()).services);
  })
);

app.get(
  "/api/team",
  asyncHandler(async (_req, res) => {
    res.json((await readStore()).team);
  })
);

app.get(
  "/api/clients",
  asyncHandler(async (_req, res) => {
    res.json((await readStore()).clients);
  })
);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    vercel: config.isVercel,
    githubConfigured: Boolean(config.githubToken && config.githubRepo),
  });
});

// ——— Auth ———
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === config.adminUsername && password === config.adminPassword) {
    const token = createAdminToken(username);
    return res.json({ token, username });
  }
  return res.status(401).json({ error: "Invalid username or password" });
});

app.post("/api/admin/logout", authRequired, (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/admin/me", authRequired, (_req, res) => {
  res.json({ username: config.adminUsername });
});

// ——— Contact ———
app.put(
  "/api/admin/contact",
  authRequired,
  asyncHandler(async (req, res) => {
    const store = await readStore();
    store.contact = { ...store.contact, ...req.body };
    await writeStore(store);
    res.json(store.contact);
  })
);

// ——— Social ———
app.put(
  "/api/admin/social",
  authRequired,
  asyncHandler(async (req, res) => {
    const store = await readStore();
    store.social = { ...store.social, ...req.body };
    await writeStore(store);
    res.json(store.social);
  })
);

app.put(
  "/api/admin/settings",
  authRequired,
  asyncHandler(async (req, res) => {
    const store = await readStore();
    const raw = req.body?.showClients;
    const showClients = raw === true || raw === "true" || raw === 1 || raw === "1";
    store.settings = {
      ...store.settings,
      showClients,
    };
    await writeStore(store);
    res.json(store.settings);
  })
);

// ——— Services ———
app.post(
  "/api/admin/services",
  authRequired,
  asyncHandler(async (req, res) => {
    const store = await readStore();
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
    await writeStore(store);
    res.status(201).json(item);
  })
);

app.put(
  "/api/admin/services/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const store = await readStore();
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
    await writeStore(store);
    res.json(store.services[idx]);
  })
);

app.delete(
  "/api/admin/services/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const store = await readStore();
    const before = store.services.length;
    store.services = store.services.filter((s) => s.id !== req.params.id);
    if (store.services.length === before) {
      return res.status(404).json({ error: "Service not found" });
    }
    await writeStore(store);
    res.json({ ok: true });
  })
);

// ——— Team ———
app.post(
  "/api/admin/team",
  authRequired,
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    const store = await readStore();
    let photo = "";
    if (req.file) {
      const filename = `${Date.now()}-${uuidv4().slice(0, 8)}${fileExt(req.file)}`;
      photo = await saveUpload(`uploads/team/${filename}`, req.file.buffer);
    }
    const item = {
      id: uuidv4(),
      name: req.body.name || "Team Member",
      role: req.body.role || "",
      bio: req.body.bio || "",
      photo,
      isLead: req.body.isLead === "true" || req.body.isLead === true,
    };
    store.team.push(item);
    await writeStore(store);
    res.status(201).json(item);
  })
);

app.put(
  "/api/admin/team/:id",
  authRequired,
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    const store = await readStore();
    const idx = store.team.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Team member not found" });

    const current = store.team[idx];
    let photo = current.photo;
    if (req.file) {
      await deleteUpload(current.photo);
      const filename = `${Date.now()}-${uuidv4().slice(0, 8)}${fileExt(req.file)}`;
      photo = await saveUpload(`uploads/team/${filename}`, req.file.buffer);
    }

    store.team[idx] = {
      ...current,
      name: req.body.name ?? current.name,
      role: req.body.role ?? current.role,
      bio: req.body.bio ?? current.bio,
      isLead: req.body.isLead !== undefined ? req.body.isLead === "true" || req.body.isLead === true : current.isLead,
      photo,
    };
    await writeStore(store);
    res.json(store.team[idx]);
  })
);

app.delete(
  "/api/admin/team/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const store = await readStore();
    const member = store.team.find((t) => t.id === req.params.id);
    if (!member) return res.status(404).json({ error: "Team member not found" });

    await deleteUpload(member.photo);
    store.team = store.team.filter((t) => t.id !== req.params.id);
    await writeStore(store);
    res.json({ ok: true });
  })
);

// ——— Clients ———
app.post(
  "/api/admin/clients",
  authRequired,
  upload.single("logo"),
  asyncHandler(async (req, res) => {
    const store = await readStore();
    let logo = "";
    if (req.file) {
      const filename = `${Date.now()}-${uuidv4().slice(0, 8)}${fileExt(req.file)}`;
      logo = await saveUpload(`uploads/clients/${filename}`, req.file.buffer);
    }
    const item = {
      id: uuidv4(),
      name: req.body.name || "Client",
      industry: req.body.industry || "",
      description: req.body.description || "",
      website: req.body.website || "",
      logo,
    };
    store.clients.push(item);
    await writeStore(store);
    res.status(201).json(item);
  })
);

app.put(
  "/api/admin/clients/:id",
  authRequired,
  upload.single("logo"),
  asyncHandler(async (req, res) => {
    const store = await readStore();
    const idx = store.clients.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Client not found" });

    const current = store.clients[idx];
    let logo = current.logo;
    if (req.file) {
      await deleteUpload(current.logo);
      const filename = `${Date.now()}-${uuidv4().slice(0, 8)}${fileExt(req.file)}`;
      logo = await saveUpload(`uploads/clients/${filename}`, req.file.buffer);
    }

    store.clients[idx] = {
      ...current,
      name: req.body.name ?? current.name,
      industry: req.body.industry ?? current.industry,
      description: req.body.description ?? current.description,
      website: req.body.website ?? current.website,
      logo,
    };
    await writeStore(store);
    res.json(store.clients[idx]);
  })
);

app.delete(
  "/api/admin/clients/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const store = await readStore();
    const client = store.clients.find((c) => c.id === req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });

    await deleteUpload(client.logo);
    store.clients = store.clients.filter((c) => c.id !== req.params.id);
    await writeStore(store);
    res.json({ ok: true });
  })
);

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
  res.status(err.status && Number.isInteger(err.status) ? err.status : 400).json({
    error: err.message || "Request failed",
  });
});

app.use("/uploads", express.static(path.join(ROOT, "uploads")));
app.use("/admin", express.static(path.join(ROOT, "admin")));
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

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Cybernetics Wings running at http://localhost:${config.port}`);
    console.log(`Admin dashboard: http://localhost:${config.port}/admin`);
    console.log(`Login: ${config.adminUsername} / ${config.adminPassword}`);
  });
}

module.exports = app;
