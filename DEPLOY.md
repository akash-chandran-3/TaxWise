# Deploying TaxWise (Render + Aiven)

```
Browser ──HTTPS──▶ Render: one Express service ──TLS──▶ Aiven: MySQL 8
                   ├─ /api/*  → the API
                   └─ /*      → the built React app (client/dist)
```

- **One Render web service** builds the React app and serves it from Express. The site and
  the API share one URL, so there's no CORS to configure and no API address to set.
- **Render has no free MySQL**, so the database lives on **Aiven's free MySQL plan**.
- **Aiven allows one free MySQL service per account.** If SoundPay already uses it, TaxWise
  shares the same server, in its own `taxwise` database. The two apps never see each other's
  tables.
- **The build runs `db:init`**, so the tables and tax rules are created on Aiven
  automatically. You don't need to run anything against Aiven from your laptop.

Before you start, commit and push everything. Render builds from GitHub, not from your laptop.

---

## 1. Database: Aiven

**If you already have an Aiven MySQL service (SoundPay):** skip to step 2 and reuse its
**Host**, **Port**, **User**, **Password** and **CA certificate**.

**Otherwise:**
1. Sign up at [aiven.io](https://aiven.io) and create a service: **MySQL**, plan **Free**.
   Wait until it shows **Running**.
2. On the service's **Overview** page, note the **Host**, **Port**, **User** (`avnadmin`) and
   **Password**, and copy the **CA certificate**.

## 2. Render web service

You can set it up either way:

- **Blueprint:** **New → Blueprint**, pick the repo, and Render reads `render.yaml`.
- **Manual:** **New → Web Service**, then use these settings.

| Setting | Value |
|---|---|
| Root Directory | *(leave empty: the repo root)* |
| Runtime | Node |
| Build Command | `cd client && npm ci --include=dev && npm run build && cd ../server && npm ci && npm run db:init` |
| Start Command | `cd server && node src/server.js` |
| Instance Type | Free |
| Health Check Path | `/api/health` (under Advanced) |

**Environment variables.** Don't set `PORT`; Render sets it.

| Key | Value |
|---|---|
| `NODE_VERSION` | `22` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` | from Aiven |
| `DB_NAME` | `taxwise` |
| `DB_SSL` | `true` |
| `DB_SSL_CA` | the whole CA certificate, from `-----BEGIN CERTIFICATE-----` to `-----END CERTIFICATE-----` |
| `JWT_SECRET` | a **new** long random string (Blueprint generates one for you) |
| `JWT_EXPIRES_IN` | `1d` |

**Notes on the build:**
- `--include=dev` is there because Vite is a dev dependency, and the build needs it.
- If `db:init` can't reach Aiven, the build fails. That's deliberate: you find out at deploy
  time, not when the first user signs up.

## 3. Check it

- Open `https://<your-service>.onrender.com/api/health`. You should see `{"status":"ok"}`.
- Open `https://<your-service>.onrender.com`, register, and try the tax and expenses pages.
- Refresh while you're on `/tax`. The page should reload, not show "Route not found".

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| The first request takes about a minute | Render's free plan **sleeps after 15 minutes idle**. Open the site a minute before a demo. |
| Build log: `vite: not found` / `Cannot find module 'vite'` | The build command is missing `--include=dev`. |
| Build log: `Database init failed: ... self-signed certificate` | `DB_SSL_CA` is missing or only partly pasted. |
| Build log: `ER_ACCESS_DENIED_ERROR` | Wrong Aiven user or password. |
| Build log: `ETIMEDOUT` / `ECONNREFUSED` | Wrong host or port, or the Aiven service is powered off. |
| Site loads but every action says "Something went wrong" | Check the Render **Logs** tab. Usually a database variable is wrong. |
| Everything stopped after a few weeks | Aiven may power off free services that sit unused. It emails first; power it back on in the console. |

## Free-tier limits worth knowing (for the interview)

- **Render free:** sleeps after 15 minutes without traffic and takes about a minute to wake.
  Only one instance, and no shell or one-off jobs (which is why `db:init` runs in the build).
- **Aiven free:** 1 GB of storage shared by every database on the service, a single node,
  no SLA.
- Both are fine for a portfolio demo, but not for real users.
