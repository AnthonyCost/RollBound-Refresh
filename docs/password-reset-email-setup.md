# Setting up email for password resets

RollBound's "Forgot your password?" link sends an email with a reset link. The code for this is already built. What's missing is a service to actually deliver the email. That service is **Resend**: RollBound hands it the email over the internet, and Resend sends it from `rollbound.com`.

You'll do five things:

1. Make a Resend account.
2. Prove to Resend that you own `rollbound.com` by adding a few records at Squarespace.
3. Make an API key (a password RollBound uses to talk to Resend).
4. Put three settings in `server/.env`.
5. Test it.

**Time:** about 20 minutes of clicking, plus up to an hour waiting for Squarespace's changes to spread.

**Before you start:** until step 4 is done, RollBound doesn't send anything. It prints each reset email, link included, in the terminal running the server. So "Forgot password" already works for testing; it just doesn't reach an inbox yet.

---

## 1. Make a Resend account

1. Go to [resend.com](https://resend.com) and choose **Get Started** (or **Sign up**).
2. Sign up with your email, or with GitHub or Google.
3. Confirm your email address if Resend asks.

The **free plan** is all you need: 3,000 emails a month and 100 a day, far more than password resets will ever use. You don't need to enter a card.

## 2. Add rollbound.com to Resend

This proves the emails really come from you, so mail providers like Gmail trust them and they don't land in spam.

### 2a. Start in Resend

1. In Resend's left menu, open **Domains**, then choose **Add Domain**.
2. **Name:** `rollbound.com`
3. **Region:** **North Virginia (us-east-1)**. This matches where your S3 bucket is.
4. Choose **Add**.

Resend now shows a table of **DNS records**, usually three or four, with columns for **Type**, **Name**, **Value**, and for one of them, **Priority**. It will look roughly like this (yours will have different long values):

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3…` (very long) | |
| TXT | `_dmarc` (sometimes listed as optional) | `v=DMARC1; p=none;` | |

**Leave this tab open.** You'll copy from it next.

> If Resend offers to set the records up for you automatically, it only works with some DNS companies. Squarespace isn't usually one of them, so follow 2b by hand.

### 2b. Add the records at Squarespace

`rollbound.com`'s DNS is managed by Squarespace Domains, so that's where these go.

1. In a new tab, sign in to [account.squarespace.com/domains](https://account.squarespace.com/domains).
2. Choose **rollbound.com**.
3. Open **DNS** (in some layouts, **DNS Settings**).
4. Scroll to **Custom records** and choose **Add record**.

Add each record from Resend's table, one at a time:

| In Squarespace's field | Put |
| --- | --- |
| **Host** | Resend's **Name**, exactly: `send`, or `resend._domainkey`, or `_dmarc`. **Don't** add `.rollbound.com` on the end; Squarespace adds it for you. |
| **Type** | Resend's **Type** (MX or TXT). |
| **Priority** | Only for the MX record: Resend's **Priority** (usually `10`). |
| **Data** (or **Value**) | Resend's **Value**. Use Resend's copy button and paste it; don't retype the long ones. |

Save each record. When you're done, Squarespace's custom records should list all of Resend's records.

**Two things to check:**

- If a Name in Resend is shown as `send.rollbound.com`, the Host is just `send`.
- If Squarespace already has a TXT record whose Host is `send` or `resend._domainkey`, don't make a second one. Edit it instead.

These records only allow sending email. They don't change your website, and they don't touch any email inbox you already have on the domain.

### 2c. Verify

1. Back in Resend, open the domain and choose **Verify DNS Records**.
2. Each record turns from **Pending** to **Verified**. This often takes a few minutes, and occasionally up to a few hours. You can close the tab and come back.
3. Move on when the domain itself shows **Verified**.

## 3. Make an API key

1. In Resend's left menu, open **API Keys**, then choose **Create API Key**.
2. **Name:** `rollbound-dev`
3. **Permission:** **Sending access**
4. **Domain:** `rollbound.com`
5. Choose **Add** (or **Create**).
6. **Copy the key now.** It starts with `re_`, and Resend shows it only once. If you lose it, delete the key and make a new one.

Treat it like a password: don't paste it in chat, into a commit, or anywhere public.

## 4. Plug it into RollBound

1. Open `server/.env` in the project. (It isn't committed to git, so your key stays private. If the file doesn't exist, copy `server/.env.example` to `server/.env` first.)
2. Add these three lines at the bottom, with your key in place of the example:

   ```bash
   RESEND_API_KEY=re_paste_your_key_here
   EMAIL_FROM="RollBound <no-reply@rollbound.com>"
   APP_URL=http://localhost:5173
   ```

   - `RESEND_API_KEY`: the key from step 3.
   - `EMAIL_FROM`: the name and address the email shows as coming from. Any address ending in `@rollbound.com` works, and nobody needs to read that inbox. Keep the quotes.
   - `APP_URL`: where the link in the email opens. `http://localhost:5173` while you're developing; change it to `https://rollbound.com` on the live site.
3. Save the file.
4. **Restart the server.** The server only reads `.env` when it starts, and editing `.env` doesn't restart it on its own. In the terminal running RollBound, press **Ctrl+C**, then run `npm run dev` again.

## 5. Test it

1. Make sure you have a RollBound account whose email is a **real inbox you can open**. Demo accounts can't reset passwords.
2. Sign out, choose **Forgot your password?** under **Create an account**, and enter that email.
3. RollBound says a link is on its way. The same message shows whether or not the account exists, so the page can't be used to discover who has an account.
4. Check your inbox for **"Reset your RollBound password"**. It usually arrives within a minute. Check spam too.
5. Click **Choose a new password**, enter a new one twice, and you're signed in with it.
6. In Resend, open **Emails** (or **Logs**). The email is listed there, with whether it was delivered.

Good to know:

- Each link works **once**, for **30 minutes**.
- Asking again replaces the older link.
- Five requests an hour from the same place, and then RollBound asks you to wait. Restarting the server resets that count.

## Using your own email designs (Resend templates)

RollBound sends two emails: the **password reset** and a **welcome** email when someone creates an account. Each one uses a template you design in Resend if you tell RollBound which one. Otherwise it sends RollBound's plain built-in version.

### 1. Add the variables to each template

In Resend, open **Templates** and choose the template. Where RollBound's details belong, add a variable: type `{{` in the editor, or choose **Variable**. Use these exact names, in capitals:

| Template | Variable | What RollBound fills in |
| --- | --- | --- |
| Password reset | `DISPLAY_NAME` | The person's display name |
| | `RESET_URL` | Their one-time reset link. Use it as your button's link. |
| | `EXPIRES_IN` | How long the link works: `30 minutes` |
| Welcome | `DISPLAY_NAME` | The person's display name |
| | `APP_URL` | A link to RollBound's home page |

You don't have to use every variable. But every variable a template **does** use must be on this list, or have a fallback value set in Resend. Otherwise Resend refuses to send it. Resend reserves `FIRST_NAME`, `LAST_NAME`, `EMAIL` and `UNSUBSCRIBE_URL` for its own contacts feature, so a template can't get those from RollBound: use `DISPLAY_NAME` for the name.

Also give each template:

- a **Subject**, since RollBound uses the template's subject;
- a **From** address ending in `@rollbound.com`, or leave it blank and RollBound uses `EMAIL_FROM`.

Then **Publish** the template. Resend only sends published templates. After later edits, publish again.

### 2. Tell RollBound which template is which

1. In Resend, open each template and copy its **ID**. If you gave it an **alias**, such as `password-reset`, the alias works too and is easier to read.
2. Add these lines to `server/.env`, with your IDs:

   ```bash
   RESEND_TEMPLATE_PASSWORD_RESET=paste-the-reset-template-id
   RESEND_TEMPLATE_WELCOME=paste-the-welcome-template-id
   ```

3. Restart the server (**Ctrl+C**, then `npm run dev`).

To test them, use **Forgot your password?**, and create a new account with an email you can open. On the live site, add the same two settings to Render's **Environment** (`docs/render-deployment.md`, step 5).

To go back to the built-in email, delete that line from `server/.env` and restart.



**Look at the terminal running the server first.** RollBound never tells the visitor when an email fails, since that would reveal the account exists, but it prints the reason in the terminal.

| What you see | What it means and what to do |
| --- | --- |
| The terminal shows `[email not configured]` and the whole email | The server isn't reading the settings. Check all three lines are in `server/.env` (not `.env.example`), saved, then restart the server. |
| `Resend refused the email (401)` or `(403)` | The API key is wrong or was deleted. Make a new key and replace the old one in `server/.env`, then restart. |
| `Resend refused the email (403)` mentioning the domain isn't verified | Step 2c isn't finished yet, or `EMAIL_FROM` isn't an `@rollbound.com` address. |
| `Resend refused the email (404)` and `Template not found` | A `RESEND_TEMPLATE_…` value doesn't match a template's ID or alias, or the template isn't published yet. |
| `Resend refused the email (422)` mentioning a variable | The template uses a variable RollBound doesn't send. Check its spelling against the table above, or give it a fallback value in Resend. |
| `Resend refused the email (422)` | Usually `EMAIL_FROM` is written wrong. It should look exactly like `"RollBound <no-reply@rollbound.com>"`, quotes included. |
| `Resend refused the email (429)` | You've hit Resend's free daily limit (100). Wait until tomorrow. |
| Nothing in the terminal, no email, and Resend's Emails list is empty | No account has that exact email, so nothing was sent. Check the spelling, or sign up with that address first. |
| The domain won't verify after a few hours | A record doesn't match. Compare each Host and Data in Squarespace with Resend's Name and Value, character for character. The usual mistake is `send.rollbound.com` typed as the Host, which becomes `send.rollbound.com.rollbound.com`. |
| Resend shows the email as **Bounced** | That inbox doesn't exist. RollBound doesn't check addresses at sign-up. |
| The email went to spam | Normal for a brand-new sending domain at first. Adding the `_dmarc` record from Resend helps, and it settles with time. |
| The link opens the wrong site | `APP_URL` is wrong. Fix it and restart. |

## Later: the live site

When RollBound is hosted somewhere other than your computer:

1. Make a second key in Resend named `rollbound-prod`, with sending access for `rollbound.com`.
2. Put the three settings in your host's **environment variables** screen, not in a file. Use the new key and `APP_URL=https://rollbound.com`.
3. Keep using `rollbound-dev` on your computer. If either key leaks, you can delete it without affecting the other.
