# Cybernetics Wings — Admin Dashboard

## Start the website + dashboard

Open PowerShell in this folder and run:

```powershell
npm install
npm start
```

Then open:

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin

Important: use `npm start` (not `npx serve`). Only `npm start` enables admin login.

## Login

- Username: `admin`
- Password: `admin123`

Change these later in `server/config.js`.

## What you can manage

1. **Contact Details** — phone, email, address, hours, etc.
2. **Social Media** — Instagram, Facebook, LinkedIn, YouTube
3. **Services** — add, edit, delete service content
4. **Our Team** — add, edit, delete members and upload photos
5. **Our Clients** — add, edit, delete clients and upload logos

Changes appear on the public website after refresh.

## Vercel / live site

The public website on Vercel is static. **Admin login does not work on Vercel.**

To update content:
1. Run `start.bat` on your PC
2. Edit at http://localhost:3000/admin
3. Commit and push to GitHub so Vercel redeploys
