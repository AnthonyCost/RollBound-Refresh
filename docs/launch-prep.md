# Launch prep

A checklist for RollBound's first, small launch. Work through it top to bottom and tick things off. The detailed steps live in the linked guides; this page is the order to do them in, and what to check.

---

## Already done

Checked on 2026-11-07, before launch:

- [x] **Everything is committed**, and no API keys or secrets are in git. `server/.env`, `server/uploads/` and `client/dist/` are correctly kept out.
- [x] **Rules tests and the client build pass.**
- [x] **The server's access tests pass** (4 of 4, run against a throwaway database): people can't see or change each other's characters, campaign data stays private, saved sheets are rebuilt from their builds, and sign-in attempts are limited.

To run the access tests again before a later launch:

```bash
createdb rollbound_test
TEST_DATABASE_URL=postgres://localhost:5432/rollbound_test npm test -w server
dropdb rollbound_test
```

---

## 1. Set up Render

Follow [render-deployment.md](render-deployment.md) from the start. That includes archiving the old RollBound project first, since a workspace gets only one free database and the domain can only be on one service.

While you're setting up the web service's **Environment**, check these values:

| Setting | Value |
| --- | --- |
| `NODE_ENV` | `production`. Without it, sign-in cookies aren't HTTPS-only. |
| `TRUST_PROXY` | `1`. Without it, the sign-in limits can't tell visitors apart behind Render's proxy. |
| `DATABASE_URL` | The database's **Internal** URL |
| `STORAGE_DRIVER` | `s3` (Render's disk is wiped on every deploy, so local storage would lose uploads) |
| `RESEND_API_KEY` | Your **`rollbound-prod`** key, not the dev one |
| `EMAIL_FROM` | `RollBound <no-reply@rollbound.com>` |
| `APP_URL` | `https://rollbound.com`, so links in emails point at the live site |
| `RESEND_TEMPLATE_PASSWORD_RESET`, `RESEND_TEMPLATE_WELCOME` | Your template IDs, if you're using templates. They need to be published in Resend. |
| AWS settings | As in step 5 of the deployment guide |

## 2. Decide on the database plan

- [ ] **Free:** fine for a trial launch, but it's **deleted 30 days after it's created** (with a 14-day grace period), and it has no backups. If you choose free, **put a calendar reminder** for day 25 to upgrade or move the data.
- [ ] **Smallest paid plan:** stays, and has daily backups. The better choice once anyone besides you is using it.

## 3. Allow uploads from the Render address (until the domain is live)

S3 only accepts uploads from the sites listed in its CORS rules, and those list `rollbound.com`, not `…onrender.com`. Until `rollbound.com` points at Render:

- [ ] Add your `https://rollbound-xxxx.onrender.com` address to `AllowedOrigins` in `infra/aws/s3-cors.json` and re-apply it to the bucket ([aws-s3-setup.md](aws-s3-setup.md), step 2). You can remove it once the domain works.

## 4. Point rollbound.com at Render

- [ ] Add the domain in Render, and the records Render shows at Squarespace (deployment guide, step 7).
- [ ] Leave Resend's DNS records (`send`, `resend._domainkey`, `_dmarc`) alone.

## 5. Click through the live site

Some parts only truly work once deployed: real email, real S3, real HTTPS. Use a **normal window and a private window** to play two people.

- [ ] **Create an account** with a real email. The welcome email should arrive.
- [ ] **Sign out, then use Forgot your password?** The reset email arrives, the link works, and you're signed in with the new password.
- [ ] **Upload a profile picture** (Account) and **a character portrait** (character settings). Both show after a reload.
- [ ] **Build a character**, or take an iconic hero, and save it.
- [ ] **Export the PDF sheet** from the character sheet.
- [ ] **Create a campaign.** Copy its invite code from Settings.
- [ ] **In the private window,** create a second account, build a character, and ask to join with the code.
- [ ] **Back as the GM,** accept the request from the inbox. The character appears in the party.
- [ ] **Run an encounter:** build one on the Encounters tab, start it, and keep the player's **Combat** tab open in the private window. Check that:
  - [ ] the player sees the turn order and whose turn it is;
  - [ ] spending actions on either side shows on the other within a few seconds;
  - [ ] damage the GM deals shows on the player's sheet.
- [ ] **Try the demo** (signed out), then use **Exit demo**.
- [ ] **Switch theme** in Account settings, and check it sticks after a reload.
- [ ] **On your phone:** open the site, sign in, and look at a character sheet and the Combat tab.

If anything fails, check the web service's **Logs** first. Most problems name themselves there: a missing setting, a refused email, an upload error.

## 6. Take the first backup

Once there's anything worth keeping, run the backup command from [render-upkeep.md](render-upkeep.md) ("Take your own copy"), and keep the file somewhere off your laptop.

---

## Good to know (not blockers)

- **The sample content:** `npm run db:setup` adds one sample campaign and character, owned by an account nobody can sign in to. You won't see them, and they're harmless.
- **The live database starts empty.** Your local test account (`dicelab@example.com`) and leftover demo data are only in your local database.
- **`debugLog.md` is in the repository.** If the GitHub repo is public, it's public too, so make sure you're happy with what it says.
- **Paizo's character sheet PDF and the Capcom placeholder art are committed,** because their lines in `.gitignore` are commented out. That's why PDF export works on the live site. Revisit this if RollBound ever opens beyond you and your table.
- **After launch,** the routine is in [render-upkeep.md](render-upkeep.md): push to `main` to update, roll back from **Events**, and a monthly checklist.
