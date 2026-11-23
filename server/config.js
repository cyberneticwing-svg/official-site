const repoFromVercel =
  process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : "";

module.exports = {
  port: process.env.PORT || 3000,
  isVercel: Boolean(process.env.VERCEL),
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  sessionSecret:
    process.env.ADMIN_JWT_SECRET ||
    process.env.SESSION_SECRET ||
    "cw-admin-session-key-change-me",
  githubToken: process.env.GITHUB_TOKEN || "",
  githubRepo: process.env.GITHUB_REPO || repoFromVercel,
  githubBranch: process.env.GITHUB_BRANCH || "main",
};
