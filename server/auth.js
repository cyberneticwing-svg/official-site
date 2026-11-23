const crypto = require("crypto");
const config = require("./config");

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", config.sessionSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", config.sessionSecret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function createAdminToken(username) {
  return signToken({
    u: username,
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
  });
}

function authRequired(req, res, next) {
  const token = req.headers["x-admin-token"];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  req.admin = payload;
  next();
}

module.exports = {
  createAdminToken,
  authRequired,
  verifyToken,
};
