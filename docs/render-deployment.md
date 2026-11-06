# Putting RollBound on Render

This guide takes RollBound from your computer to `https://rollbound.com`, hosted on [Render](https://render.com). It starts by archiving the RollBound project you already have on Render, then sets up the new one.

**How it fits together:** Render runs **one web service** that serves both the website and its API from one address, plus **one Postgres database**. Uploaded images go to your S3 bucket (`docs/aws-s3-setup.md`) and emails go through Resend (`docs/password-reset-email-setup.md`). Render doesn't store either.

**Time:** about 45 minutes, plus waiting for DNS.

**Before you start, have these ready:**

- The project pushed to GitHub (step 2).
- Your S3 bucket working (`rollbound-refresh`, us-east-1) and an AWS access key for it (step 4).
- Resend set up, with a **`rollbound-prod`** API key (the last section of the Resend guide).
- `pg_dump` on your computer, if you want to keep the old project's data. It comes with Postgres. Check by running `pg_dump --version`.

---

## 1. Archive the old RollBound project

Render has no "archive" button. Archiving here means four things:

- back up the data;
- note the settings;
- stop the services;
- release what the new project needs: the free database slot and the domain.

Do this first. Render allows **one free database per workspace**, and a domain can belong to only one service at a time.

### 1a. Back up the old database (if you want its data)

1. In the [Render dashboard](https://dashboard.render.com), open the old project, then its **Postgres** database.
2. On the database's **Info** page, find **Connections**. Copy the **External Database URL** (it starts with `postgresql://`).
3. In a terminal on your computer, run (paste the URL inside the quotes):

   ```bash
   pg_dump "postgresql://…paste-the-external-url…" --no-owner --format=custom --file=rollbound-archive.dump
   ```

4. Check it worked: `rollbound-archive.dump` should be in that folder and more than a few KB. Keep it somewhere safe, such as a cloud drive.

(Free databases have no backups of their own on Render, so this file is the only copy once the database is deleted. If you ever need it back: `pg_restore --no-owner --dbname "<a database URL>" rollbound-archive.dump`.)

### 1b. Note the old settings

For each old service, open **Environment** and copy anything you might reuse (API keys and the like) into a private note. You'll set the new service's settings fresh in step 5.

### 1c. Free up the domain

If `rollbound.com` (or `www.rollbound.com`) is on an old service:

1. Open that service, go to **Settings**, and scroll to **Custom Domains**.
2. **Delete** each `rollbound.com` entry. This only detaches the domain from Render. Your website goes offline until step 7, but nothing at Squarespace changes yet.

### 1d. Stop the old services

1. Open each old web service, go to **Settings**, scroll to the bottom and choose **Suspend Web Service**. A suspended service keeps all its settings and can be resumed any time, but doesn't run or bill.
2. For the old **database**: once 1a is done, open it, go to **Settings** and choose **Delete Database**. This frees your one free database slot. If you'd rather keep it and use a paid database for the new project (step 3), you can **Suspend** it instead.

### 1e. Label it

Open the old project, choose **Settings**, and rename it to **RollBound (archived)**, so it's clearly not the live one.

Later, if you're sure you'll never need it: **Settings → Delete project** removes it and everything left in it.

---

## 2. Get the code onto GitHub

Render deploys from a GitHub repository and redeploys whenever you push to it.

1. Commit everything, including two small files this deploy needs, already in the project:
   - `server/src/index.js`: the server now also serves the built website, so one Render service runs the whole app.
   - `.node-version`: tells Render to use Node 24.
2. Push to your GitHub repository's `main` branch.

`server/.env` is not committed, and must never be. Your secrets go into Render's settings in step 5 instead.

## 3. Create the database

1. In Render, choose **New → Project** and name it **RollBound**. Create it with its default environment (Production).
2. Inside the project, choose **New → Postgres**:
   - **Name:** `rollbound-db`
   - **Database / User:** leave them blank, and Render picks them.
   - **Region:** **Virginia (US East)**, beside your S3 bucket in us-east-1.
   - **PostgreSQL version:** the default.
   - **Instance type:** see the note below.
3. Choose **Create Database** and wait until it says **Available**.
4. On its **Info** page, copy the **Internal Database URL**. The web service uses it in step 5. The internal one only works inside Render, which is what you want.

> **Free or paid database?** A free Render database **expires 30 days after it's created**. After a 14-day grace period, Render deletes it and everyone's characters and campaigns with it. Free databases also have no backups. For a site people will actually use, choose the smallest paid instance type; Render lists the current price on that screen. Free is fine for trying the deploy, if you remember the 30 days.

## 4. An AWS key for Render

Your image uploads use S3. On AWS itself, the server would get a role; Render has no AWS roles, so it needs an access key.

1. In the AWS console, open **IAM → Users → Create user**. Name it `rollbound-render`. It doesn't need console access.
2. **Permissions:** **Attach policies directly → Create policy**. On the **JSON** tab, paste the contents of `infra/aws/iam-policy.json`, then name and create it (for example `rollbound-uploads`). Back in the user setup, attach that policy.
3. Open the new user, go to **Security credentials → Create access key**, and choose **Application running outside AWS**.
4. Copy the **Access key ID** and **Secret access key**. AWS shows the secret only once.

## 5. Create the web service

1. In the RollBound project, choose **New → Web Service**, then **Git Provider**, and pick your repository. Connect GitHub if Render asks.
2. Fill in:

   | Field | Value |
   | --- | --- |
   | **Name** | `rollbound` |
   | **Region** | **Virginia (US East)**, the same as the database |
   | **Branch** | `main` |
   | **Root Directory** | leave blank |
   | **Language** | Node |
   | **Build Command** | `npm ci --include=dev && npm run build` |
   | **Start Command** | `npm run db:setup && npm start --workspace server` |
   | **Instance Type** | your choice; see the note below |

3. Under **Environment Variables**, add each of these (**Add Environment Variable** for each row):

   | Key | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the **Internal Database URL** from step 3 |
   | `TRUST_PROXY` | `1` |
   | `STORAGE_DRIVER` | `s3` |
   | `AWS_REGION` | `us-east-1` |
   | `S3_BUCKET` | `rollbound-refresh` |
   | `S3_PUBLIC_URL` | `https://rollbound-refresh.s3.us-east-1.amazonaws.com` |
   | `AWS_ACCESS_KEY_ID` | from step 4 |
   | `AWS_SECRET_ACCESS_KEY` | from step 4 |
   | `RESEND_API_KEY` | your **`rollbound-prod`** Resend key |
   | `EMAIL_FROM` | `RollBound <no-reply@rollbound.com>` (no quotes needed here) |
   | `APP_URL` | `https://rollbound.com` |
| `RESEND_TEMPLATE_PASSWORD_RESET` | optional: your reset template's ID or alias |
| `RESEND_TEMPLATE_WELCOME` | optional: your welcome template's ID or alias |

4. Open **Advanced** and set **Health Check Path** to `/api/health`. Render then only switches to a new version once it answers.
5. Choose **Deploy Web Service**.

**What each setting is for:**

- `--include=dev` in the build installs the tools that build the website. Without it, `NODE_ENV=production` would skip them and the build would fail.
- `npm run db:setup` in the start command creates or updates the database tables on every start. It's safe to run again. It also adds one sample campaign and character, owned by a sample account nobody can sign in to.
- `NODE_ENV=production` makes sign-in cookies HTTPS-only.
- `TRUST_PROXY=1` lets the sign-in limits see each visitor's real address behind Render's proxy.

> **Free or paid web service?** A free web service goes to sleep after 15 minutes with no visitors, and the next visit waits about a minute while it wakes. That's fine for a portfolio, though the first click feels slow. Any paid instance type stays awake.

## 6. Check the deploy

1. On the service's **Logs**, watch the build and then the start. You should see `Ran schema.sql`, `Ran seed.sql`, then `RollBound API on http://localhost:10000` (Render picks the port, and that's fine).
2. Open the service's address at the top of its page: `https://rollbound-xxxx.onrender.com`.
3. Create an account, build a character, and open a campaign. The data is in the new database.
4. **Uploads from this address:** S3 only accepts uploads from sites listed in its CORS rules, and those list `rollbound.com`, not `onrender.com`. To test a portrait upload before step 7, add your `https://rollbound-xxxx.onrender.com` address to `AllowedOrigins` in `infra/aws/s3-cors.json` and re-apply it to the bucket (see `docs/aws-s3-setup.md`). Or wait until the domain is live.

## 7. Point rollbound.com at Render

1. In the service, open **Settings**, then **Custom Domains**, then **Add Custom Domain**, and add `rollbound.com`. Add `www.rollbound.com` too.
2. Render shows the DNS records each one needs. Usually:
   - `rollbound.com`: an **A** record pointing to an IP address Render gives you.
   - `www.rollbound.com`: a **CNAME** pointing to `rollbound-xxxx.onrender.com`.
3. At Squarespace ([account.squarespace.com/domains](https://account.squarespace.com/domains) → **rollbound.com** → **DNS**):
   - In **Custom records**, choose **Add record** for each one. **Host** is `@` for `rollbound.com` and `www` for `www.rollbound.com`. Copy the type and the **Data** exactly from Render.
   - If Squarespace already has records for `@` or `www` (often a **Squarespace Defaults** group pointing at a Squarespace site), delete those first. Two records for the same host conflict.
   - **Leave Resend's records alone** (`send`, `resend._domainkey`, `_dmarc`). Email keeps working.
4. Back in Render, choose **Verify** next to each domain. Once verified, Render issues the HTTPS certificate automatically. This can take from a few minutes to an hour.
5. Open `https://rollbound.com`. Sign in, upload a portrait, and try **Forgot your password?** with a real email to check all three services together.

---

## Everyday use

- **Updating the site:** push to `main` and Render rebuilds and redeploys on its own. Watch progress under **Events** and **Logs**.
- **Rolling back:** under **Events**, choose an earlier deploy and **Rollback**.
- **Changing a setting:** under **Environment**, edit it and save. Render restarts the service with the new value.
- **Backing up the database:** paid databases get daily backups under **Recovery**. To take your own copy, run the `pg_dump` command from step 1a with the new database's External URL.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| The build fails with `vite: not found` | The build command is missing `--include=dev`. |
| The build fails on Node features, or the log shows Node 18 or 20 | `.node-version` wasn't pushed. Push it, or add `NODE_VERSION` = `24` under **Environment**. |
| The start fails with `ECONNREFUSED` or `password authentication failed` | `DATABASE_URL` is wrong. Use the database's **Internal** URL, and check both are in the same region. |
| The site loads, but signing in does nothing | `NODE_ENV=production` needs HTTPS. Use the `https://` address, never `http://`. |
| Portrait uploads fail | On the `onrender.com` address, see step 6.4. On `rollbound.com`, check the AWS key, `S3_BUCKET` and `S3_PUBLIC_URL` under **Environment**. The log line names what failed. |
| Reset emails don't arrive | The service's **Logs** show the reason. See the table in `docs/password-reset-email-setup.md`. Check `APP_URL` is `https://rollbound.com`. |
| `rollbound.com` won't verify | The Squarespace records don't match Render's, or an old `@`/`www` record is still there. Give DNS up to an hour after fixing. |
| The first visit takes about a minute | The free instance was asleep (step 5). Expected. |
