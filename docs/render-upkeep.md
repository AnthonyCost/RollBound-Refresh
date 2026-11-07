# Looking after RollBound on Render

What to do once the site is live (`docs/render-deployment.md` covers getting it there): shipping updates, keeping the database safe, resetting it when you need to, and a short checklist for each month.

**What lives where:**

| Thing | Where it lives | How it changes |
| --- | --- | --- |
| The code (pages, server, rules data, logo) | GitHub, `main` branch | Push to `main`, and Render redeploys |
| Settings and secrets (keys, `APP_URL`) | Render, the service's **Environment** page | Edit there. Never commit them. |
| Accounts, characters, campaigns, logs, encounters | The Render Postgres database | Through the site, or with the steps below |
| Uploaded images (portraits, covers, profile pictures) | Your S3 bucket, `rollbound-refresh` | Through the site. A database reset doesn't touch them. |

---

## Shipping updates

1. Work locally with `npm run dev`, as usual.
2. Before pushing, run `npm run build` and `npm test` from the project folder. The build is the same one Render runs, so if it fails here it would fail there.
3. Commit and push. Render rebuilds and deploys in a few minutes. Watch progress under the service's **Events** and **Logs**.
4. Open the live site and check what you changed.

**Use a working branch once people play on the site.** Everything pushed to `main` goes live straight away. Do bigger work on a branch (`git switch -c encounter-fixes`), and merge it into `main` when it's ready.

**If a deploy breaks something:** in **Events**, choose the last good deploy, then **Rollback**. Then fix the problem locally and push again.

**What a deploy resets, and what it doesn't:**

- Sign-ins survive, since sessions live in the database.
- The sign-in and demo rate limits start fresh. They're kept in memory and are harmless to reset.
- Expired demo accounts are cleaned up hourly while the site is running. On a free instance that sleeps, the cleanup runs when it wakes.

## Updating rules data, art and the logo

These are all files in the repository, so they ship like any other change:

- **Rules, armory, bestiary or glossary data:** run the import locally (`npm run data:import`, or the armory or glossary script with `--workspace @rollbound/rules`), check the site, then commit the changed JSON and push.
- **Art and the logo:** replace the files, then commit and push. Browsers cache the tab icon hard, so it may take a hard refresh (Ctrl+Shift+R) to see a new one.

---

## The database

### How table changes reach the live site

The start command runs `npm run db:setup` on every deploy. That runs `server/db/schema.sql`, which only **adds**: new tables and new columns, written so they're skipped if they already exist. That's why adding a feature with a new table just works when you push it.

**The rule for changing `schema.sql`:**

- **Adding** a table, column or index is safe. Write it the same way: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.
- **Changing existing data**, like the theme renames (`UPDATE users SET theme = …`), is fine if it's safe to run on every start. Running it a second time must change nothing.
- **Removing or renaming** a table or column deletes or hides people's data. Don't put that in `schema.sql`. Plan it as a one-off: take a backup, test it on a copy, then run it once by hand.

### Backups

- **Paid databases** get automatic backups, which you restore from the database's **Recovery** page. Check what your instance type includes, since some plans go further back than others.
- **Free databases have no backups.** Your own copy is the only one.

**Take your own copy** before anything risky, like a reset, a by-hand change, or deleting the database:

1. In Render, open the database. On the **Info** page, under **Connections**, copy the **External Database URL**.
2. On your computer:

   ```bash
   pg_dump "postgresql://…external-url…" --no-owner --format=custom --file=rollbound-2026-11-07.dump
   ```

3. Keep the file somewhere safe and off your laptop, such as a cloud drive.

**To restore a copy into a database** (this replaces what's there):

```bash
pg_restore --no-owner --clean --if-exists --dbname "postgresql://…external-url…" rollbound-2026-11-07.dump
```

**To test a change on a copy first**, restore the dump into a local database and point your local server at it:

```bash
createdb rollbound_copy
pg_restore --no-owner --dbname rollbound_copy rollbound-2026-11-07.dump
```

Then set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/rollbound_copy` in `server/.env` and run `npm run dev`. Change it back afterward.

### Resetting the database

Pick the smallest reset that does the job. **Take a backup first** (above) whichever you choose.

#### Remove one account (a test account, or a request to delete)

Deleting an account deletes its characters and its sign-ins. It does **not** delete campaigns it runs; those would be left with no GM. So delete them first. In a terminal:

```bash
psql "postgresql://…external-url…"
```

Then, with the account's email in both places:

```sql
BEGIN;
DELETE FROM campaigns WHERE gm_user_id = (SELECT id FROM users WHERE email = 'someone@example.com');
DELETE FROM users WHERE email = 'someone@example.com';
COMMIT;
```

If the numbers it reports look wrong, type `ROLLBACK;` instead of `COMMIT;` and nothing changes.

Their uploaded images stay in S3; see "After a full reset: images" below.

#### Wipe everything and start fresh

Before launch, or to clear out all test data. This deletes **every** account, character, campaign, log and encounter.

1. Take a backup (above).
2. Connect with `psql "postgresql://…external-url…"` and run:

   ```sql
   DROP OWNED BY CURRENT_USER CASCADE;
   ```

   This removes every table the app made, and the data in them.
3. In Render, open the web service and choose **Manual Deploy → Deploy latest commit**, or **Restart service**. On start, `db:setup` builds empty tables again, plus its one sample campaign and character, owned by an account nobody can sign in to.
4. Everyone, you included, is signed out and has to create a new account.

#### Replace the database entirely

If the database is badly broken, or you're moving to a different plan or region:

1. Take a backup if there's anything worth keeping.
2. Create a new Postgres database (`docs/render-deployment.md`, step 3).
3. Paste its **Internal Database URL** into the web service's `DATABASE_URL` under **Environment** and save. Render restarts the service, and `db:setup` creates the tables.
4. Restore your backup into the new database if you want the old data in it.
5. Delete the old database once you're sure.

#### After a full reset: images

The images people uploaded stay in S3 after a database reset, with nothing pointing to them any more. They cost very little, but to clear them out, delete the `covers/`, `avatars/` and `portraits/` folders in the bucket. In the AWS console: **S3 → rollbound-refresh**, select the folders, then **Delete**. Only do this after a full wipe; deleting them otherwise breaks everyone's images.

---

## Settings and secrets

- **Changing a setting:** edit it on the service's **Environment** page and save. Render restarts the site with it.
- **If a key leaks** (pasted somewhere public, or committed by mistake):
  1. Make a new key: a new Resend API key, or a new AWS access key for `rollbound-render`.
  2. Put the new key in Render.
  3. Delete the old key in Resend or AWS.

  Removing a leaked key from git history doesn't help; it's already out.
- **Keep the live and local keys separate** (`rollbound-prod` and `rollbound-dev` in Resend), so revoking one doesn't break the other.

## Monthly checklist

- [ ] **Logs:** skim the web service's **Logs** for repeated errors, such as `Password reset email failed`, `Something went wrong` or upload failures.
- [ ] **Database:** open it in Render and check **storage used** against the plan's limit. If it's free, check its **expiry date**: free databases are deleted 30 days after they're created, so upgrade or move the data before then.
- [ ] **Backup:** take a `pg_dump` copy (above) and file it with last month's.
- [ ] **Resend:** check **Emails** for bounces, and that you're well under the free plan's daily limit.
- [ ] **AWS:** check the month's S3 bill. It should be pennies; anything more means a lot of uploads or something wrong.
- [ ] **Updates:** run `npm outdated` in the project. Update a package by itself, check the site locally, then push. Don't update everything at once.
- [ ] **Domain:** check `rollbound.com` isn't close to expiring at Squarespace, and that auto-renew is on.

## If the site is down

1. **The service's Logs.** A crash on start usually names the problem: a missing setting, or the database refusing the connection.
2. **Events.** If the problem started with the latest deploy, **Rollback** to the one before it, and debug locally.
3. **The database's page.** Check it's **Available**, and that a free one hasn't expired.
4. **[status.render.com](https://status.render.com).** Check whether Render itself is having trouble.
5. **On a free instance**, a first visit after a quiet spell takes about a minute while it wakes. That's normal, not an outage.
