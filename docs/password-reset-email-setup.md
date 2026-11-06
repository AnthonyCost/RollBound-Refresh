# Setting up email for password resets

RollBound sends "Forgot password" emails through **Resend**. You don't run a mail server: Resend sends the mail, and RollBound calls it with an API key.

You'll do four things: make a Resend account, prove you own `rollbound.com`, make an API key, and put three settings in `server/.env`. It takes about 15 minutes, plus waiting for DNS.

> The app code that sends these emails comes next. These steps get the account ready, and the setting names below are the ones the code will use.

## 1. Make a Resend account

1. Go to [resend.com](https://resend.com) and sign up. The free plan is plenty.
2. Confirm your email address when Resend asks.

## 2. Add your domain

This proves the emails really come from `rollbound.com`, so they don't land in spam.

1. In Resend, open **Domains** and choose **Add Domain**.
2. Enter `rollbound.com`. For **Region**, pick **North Virginia (us-east-1)**, the same as your bucket.
3. Resend shows a short list of DNS records (usually 3 or 4: an **MX** record, a couple of **TXT** records, and sometimes a DMARC one).
4. Open a second tab at the company that manages DNS for `rollbound.com` (where you bought the domain, or Route 53 if you moved it there).
5. Add each record exactly as Resend shows it: the same **type**, **name** and **value**. Copy and paste; don't retype.
   - If the **name** field at your DNS company already adds `.rollbound.com` on the end, enter only the first part (e.g. `send`, not `send.rollbound.com`).
6. Back in Resend, choose **Verify DNS Records**. It can take a few minutes, occasionally a few hours. Wait until the domain shows **Verified**.

These records only add email sending. They don't affect the website or any email inbox you already have on the domain.

## 3. Make an API key

1. In Resend, open **API Keys** and choose **Create API Key**.
2. **Name:** `rollbound-dev`.
3. **Permission:** **Sending access**. **Domain:** `rollbound.com`.
4. Copy the key (it starts with `re_`). Resend shows it only once; if you lose it, delete it and make a new one.

Later, for the live site, make a second key named `rollbound-prod` and put it in your host's settings, not in a file.

## 4. Add the settings to `server/.env`

Add these three lines to `server/.env` (never commit this file):

```bash
RESEND_API_KEY=re_paste_your_key_here
EMAIL_FROM="RollBound <no-reply@rollbound.com>"
APP_URL=http://localhost:5173
```

- `RESEND_API_KEY`: the key from step 3.
- `EMAIL_FROM`: who the email says it's from. Any address `@rollbound.com` works; nobody needs to read that inbox.
- `APP_URL`: where the reset link sends people. Use `http://localhost:5173` while developing, and `https://rollbound.com` on the live site.

Then restart the API (`npm run dev:server`, or `npm run dev`).

## 5. Check it works

Once the reset code is in:

1. Sign out, choose **Forgot password**, and enter your own account's email.
2. The email should arrive within a minute. If it's not in your inbox, check spam.
3. Click the link, set a new password, and sign in with it.
4. In Resend, **Emails** lists everything sent, so you can see whether it went out.

## If something goes wrong

| Problem | What to check |
| --- | --- |
| The domain won't verify | The records don't match exactly. Compare each name and value with Resend's, and check the name doesn't end up as `send.rollbound.com.rollbound.com`. Give DNS an hour before trying again. |
| No email arrives, and Resend's **Emails** list is empty | The API key or `EMAIL_FROM` is wrong in `server/.env`, or the API wasn't restarted after editing it. |
| Resend shows the email as **bounced** | The address on that account isn't real. RollBound doesn't check addresses at sign-up, so only accounts with a real email can reset. |
| The email went to spam | Usually settles once the domain is verified for a while. Adding the DMARC record Resend suggests also helps. |
| The link opens the wrong site | `APP_URL` is wrong. |
