# Cybernetics Wings — Admin Dashboard

## Local (your PC)

```powershell
npm install
npm start
```

Or double-click `start.bat`.

- Website: http://localhost:3000  
- Admin: http://localhost:3000/admin  

Login:

- Username: `admin`
- Password: `admin123`

## Admin on Vercel (live site)

Admin can run on your Vercel URL (example: `https://your-site.vercel.app/admin`).

### 1. Create a GitHub token

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Generate a token for the `official-site` repo
3. Permission needed: **Contents: Read and write**
4. Copy the token

### 2. Add env vars in Vercel

Vercel → your project → **Settings** → **Environment Variables**:

| Name | Value |
|------|--------|
| `GITHUB_TOKEN` | the token from step 1 |
| `ADMIN_PASSWORD` | a strong password (recommended) |
| `ADMIN_JWT_SECRET` | any long random string |

Optional:

| Name | Value |
|------|--------|
| `ADMIN_USERNAME` | default `admin` |
| `GITHUB_REPO` | `cyberneticwing-svg/official-site` (auto-detected on Vercel) |
| `GITHUB_BRANCH` | `main` |

### 3. Redeploy

After saving env vars, trigger a Redeploy on Vercel.

Then open: `https://YOUR-SITE.vercel.app/admin`

### How saves work on Vercel

When you save in admin, the API commits updates to GitHub. Vercel then redeploys (~1 minute) so the public site updates.

## What you can manage

1. **Contact Details**
2. **Social Media**
3. **Services**
4. **Our Team** (photo uploads)
5. **Our Clients** (logo uploads + show/hide)
