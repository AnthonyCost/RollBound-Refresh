# Moving uploaded images to AWS S3

The code for S3 is already in place. This guide covers the AWS setup you do by hand, and the settings that switch RollBound from local storage to S3. The bucket is **`rollbound-refresh`** and the site will live at **`rollbound.com`**; the config files in `infra/aws/` already use both.

RollBound stores three kinds of uploaded image, each in its own folder (prefix) in the bucket:

| Image | Prefix | Max size | Set from |
| --- | --- | --- | --- |
| Campaign cover | `covers/` | 5 MB | The campaign creator and editor |
| Account profile image | `avatars/` | 2 MB | The Account page |
| Character portrait | `portraits/` | 5 MB | The character sheet, or the builder's review step |

## How it works

```
Browser ──1. "I want to upload a 2 MB PNG portrait"──▶ RollBound API
        ◀──── signed S3 upload URL (10 min) ───────────
Browser ──2. PUT the file─────────────────────────────▶ S3 bucket   (tagged state=pending)
Browser ──3. attach the key to the character──────────▶ RollBound API ──checks the file is a real image,
                                                                       retags it state=attached
Players ◀─4. load the image─────────────────────────── CloudFront ◀── S3 bucket (private)
```

- **The file never passes through the API.** The browser uploads it straight to S3 with a presigned URL.
- **The signature covers the content type, the exact size, and the `state=pending` tag.** S3 rejects anything else, and the API enforces each kind's size limit.
- **The API checks every image before using it.** It confirms the file is the right kind and was uploaded by the same user, then reads its first bytes from S3 to make sure it really is a JPEG, PNG or WebP.
- **Abandoned uploads clean themselves up.** If someone uploads an image but never saves it, the file stays `pending`, and a lifecycle rule deletes it after a day.
- **Replaced and removed images are deleted** right away. Deleting a character deletes its portrait.
- **The bucket stays private.** Players load images through CloudFront.

The code for all of this is in `server/src/storage/s3.js`.

You'll fill in two placeholders as you go, both in `infra/aws/s3-bucket-policy.json`:

| Placeholder | Replace with |
| --- | --- |
| `YOUR_ACCOUNT_ID` | Your 12-digit AWS account ID (top-right account menu in the console) |
| `YOUR_DISTRIBUTION_ID` | The CloudFront distribution ID (from step 4) |

Pick one **region** close to where the server will run (e.g. `us-east-2`) and use it everywhere below. The commands assume the AWS CLI v2, signed in with an admin profile (`aws configure` or `aws sso login`). Every step also has a console route.

## 1. Create the bucket

In the **S3** console, choose **Create bucket**:

- **Bucket type:** General purpose.
- **Name:** `rollbound-refresh`. Bucket names are global; if it's taken, pick another and replace `rollbound-refresh` in `infra/aws/*.json` and below.
- **Region:** your chosen region. It goes in `AWS_REGION`.
- **Object Ownership:** ACLs disabled (the default).
- **Block all public access:** leave it **on**. CloudFront reads the bucket privately.
- **Default encryption:** SSE-S3 (the default) is fine.

Or with the CLI:

```bash
aws s3api create-bucket --bucket rollbound-refresh --region us-east-2 \
  --create-bucket-configuration LocationConstraint=us-east-2
```

Leave out `--create-bucket-configuration` if you use `us-east-1`.

## 2. Allow browser uploads (CORS)

Browsers upload straight to the bucket, so the bucket must allow the site's origin. `infra/aws/s3-cors.json` allows `http://localhost:5173` (the dev server), `https://rollbound.com` and `https://www.rollbound.com`. Origins must match exactly, so if the site ever runs anywhere else (a staging subdomain, another port), add it here and re-run the command.

```bash
aws s3api put-bucket-cors --bucket rollbound-refresh --cors-configuration file://infra/aws/s3-cors.json
```

In the console it's under **Bucket → Permissions → Cross-origin resource sharing (CORS)**. The console wants only the array, so paste the `[ ... ]` part of `CORSRules`.

## 3. Delete abandoned uploads automatically

```bash
aws s3api put-bucket-lifecycle-configuration --bucket rollbound-refresh \
  --lifecycle-configuration file://infra/aws/s3-lifecycle.json
```

This deletes any object still tagged `state=pending` after one day, whether it's a cover, avatar or portrait. Images in use are tagged `state=attached`, so the rule never touches them.

In the console: **Bucket → Management → Create lifecycle rule**. Limit the rule to the object tag `state` = `pending` (no prefix), and choose **Expire current versions of objects** after **1** day.

## 4. Serve images through CloudFront

1. Open **CloudFront → Create distribution**. If the console asks you to choose a pricing plan, the free or pay-as-you-go option is plenty for this site.
2. **Origin:** choose **Amazon S3** and pick `rollbound-refresh`. Choose the option that keeps the bucket private and grants CloudFront access: **Origin access control (OAC)**, often shown as "Allow private S3 bucket access to CloudFront". Don't pick the legacy OAI or the bucket's website endpoint (OAC doesn't work with website endpoints).
3. **Recommended settings:** the wizard's recommended cache settings for an S3 origin use `CachingOptimized`, which suits these images (each key is unique and never changes). Make sure viewers are redirected from HTTP to HTTPS.
4. **Security:** web application firewall (WAF) protection is optional; you can skip it.
5. Create the distribution, then note its **ID** (like `E1ABCDEF2GHIJK`) and **domain** (like `d1234abcd.cloudfront.net`). It takes a few minutes to deploy.
6. **Bucket policy:** the wizard may add a policy to the bucket for you. Replace it with the stricter one in `infra/aws/s3-bucket-policy.json`, which lets CloudFront read only the three image folders and refuses any request made without HTTPS:
   1. Put your account ID and distribution ID into the file.
   2. Paste it into **Bucket → Permissions → Bucket policy**, or run:

      ```bash
      aws s3api put-bucket-policy --bucket rollbound-refresh --policy file://infra/aws/s3-bucket-policy.json
      ```

7. **CORS for reading images back:** the app fetches a character's portrait to put it into the exported PDF sheet. In the distribution, open **Behaviors**, edit the default behavior, and set:
   - **Origin request policy:** `CORS-S3Origin`
   - **Response headers policy:** `CORS-With-Preflight`

   The bucket's CORS rules from step 2 already allow `GET` from your site.

Your `S3_PUBLIC_URL` is `https://` plus the distribution's domain, or `https://images.rollbound.com` once you do step 4b.

### 4b. Optional: serve images from images.rollbound.com

Images work fine from the `cloudfront.net` address; this only makes the URLs your own. RollBound stores image keys, not full URLs, so you can do this any time: existing images switch over as soon as `S3_PUBLIC_URL` changes.

1. **Certificate:** in **AWS Certificate Manager**, switch the region to **US East (N. Virginia) `us-east-1`** (CloudFront only uses certificates from there, whatever region the bucket is in). Request a public certificate for `images.rollbound.com` with **DNS validation**, and add the CNAME record it gives you at your DNS provider. Wait until it shows **Issued**.
2. **Distribution:** edit the distribution's settings, add `images.rollbound.com` as an **alternate domain name**, and choose that certificate.
3. **DNS:** at your DNS provider, point `images.rollbound.com` at the distribution: a **CNAME** to `d1234abcd.cloudfront.net`, or an **alias A/AAAA** record if the domain is in Route 53.
4. Set `S3_PUBLIC_URL=https://images.rollbound.com` and restart the API.

Use a subdomain rather than `rollbound.com` itself, which the app will use.

> **Without CloudFront:** you can turn off "Block public access" and allow public `s3:GetObject` on `covers/*`, `avatars/*` and `portraits/*`, then set `S3_PUBLIC_URL=https://rollbound-refresh.s3.<region>.amazonaws.com`. It's simpler, but the bucket is public and there's no caching. CloudFront is recommended.

## 5. Give the server permission

The server needs exactly the permissions in `infra/aws/iam-policy.json` (already filled in for `rollbound-refresh`):
- put, tag, read and delete objects under `covers/`, `avatars/` and `portraits/`,
- list the bucket, so a missing file returns "not found" instead of "access denied".

**For local development:**
1. In **IAM → Users**, create a user such as `rollbound-dev`. It doesn't need console access.
2. On the user, choose **Add permissions → Create inline policy → JSON**, paste `infra/aws/iam-policy.json`, and name it `rollbound-images`.
3. Under **Security credentials**, create an **access key**. When asked for a use case, choose **Application running outside AWS** (or **Local code**); the console suggests alternatives, but a scoped key is fine for a dev machine.
4. Put the key ID and secret in `server/.env` (step 6). That file is in `.gitignore`; never commit it. If a key ever leaks, deactivate it in IAM and create a new one.

**In production:** if rollbound.com runs on AWS (EC2, ECS, App Runner, Lambda), give the server an **IAM role** with the same policy and leave the access keys out of `.env`; the AWS SDK finds role credentials on its own. On a host outside AWS (Render, Fly.io, a VPS), create a separate IAM user such as `rollbound-prod` with the same inline policy, and set its keys as that host's environment variables. Don't reuse the dev key.

## 6. Switch RollBound to S3

In `server/.env`, change `STORAGE_DRIVER` and add the S3 settings (the same block is commented out in `server/.env.example`):

```bash
STORAGE_DRIVER=s3
AWS_REGION=us-east-2
S3_BUCKET=rollbound-refresh
S3_PUBLIC_URL=https://d1234abcd.cloudfront.net

# Development only; use an IAM role in production.
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Restart the API (`npm run dev:server`, or `npm run dev` for both). If anything required is missing, it refuses to start and names the missing setting. `UPLOAD_SECRET` and `UPLOAD_DIR` only apply to the local driver, so you can leave them out.

You don't need to change anything in the client or the database. To go back to local storage, set `STORAGE_DRIVER=local` and restart.

## 7. Move existing images (if any)

Images uploaded while using local storage live in `server/uploads/`. Their keys are the same in S3, so copy them across and everything keeps working:

```bash
aws s3 sync server/uploads s3://rollbound-refresh
```

Copied files have no `state` tag, so the lifecycle rule leaves them alone. They show from CloudFront once `S3_PUBLIC_URL` is set.

## 8. Check it works

1. Sign in and create a campaign with a cover image.
2. In the browser's dev tools **Network** tab, the upload should be a `PUT` to `rollbound-refresh.s3.<region>.amazonaws.com` returning **200**.
3. The campaign page's cover should load from your CloudFront domain.
4. In the S3 console, the object under `covers/` should be tagged `state=attached`.
5. Edit the campaign and replace the cover. The old object should disappear from the bucket.
6. Set a profile image on the Account page, and a portrait from a character sheet. They should land under `avatars/` and `portraits/`.
7. Export a character sheet as a PDF. The portrait should be in it (this checks step 4.7).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Upload fails in the browser with a **CORS** error | Your site's origin isn't in `s3-cors.json` (e.g. you're on `www.` but only the bare domain is listed), or `x-amz-tagging` is missing from `AllowedHeaders`. Origins must match exactly, including `https://` and the port. |
| Upload returns **400** mentioning a **checksum** (e.g. `BadDigest`) | The upload URL was signed with a checksum. `s3.js` sets `requestChecksumCalculation: 'WHEN_REQUIRED'` to prevent this; check that it's still there. |
| Upload returns **403 SignatureDoesNotMatch** | The browser sent different headers than were signed. The client sends exactly the `headers` the API returns, so look for a proxy or extension that changes the request. A server clock that's minutes off also causes this. |
| Upload returns **403 AccessDenied** | The IAM user or role is missing `s3:PutObject` or `s3:PutObjectTagging`, or its policy names a different bucket. |
| Saving says **"That image upload was not found"** | The upload didn't finish, the file isn't a real image, or the server lacks `s3:GetObject` on that prefix. |
| Server logs show **AccessDenied** when saving | The role is missing `s3:ListBucket`. Without it, S3 reports missing files as "access denied" instead of "not found". |
| The PDF sheet exports without the portrait | CloudFront isn't passing CORS headers. Check the origin request and response headers policies in step 4.7. |
| Images upload but don't display (**403** from CloudFront) | The bucket policy doesn't name your account and distribution IDs, or the distribution uses OAI instead of OAC. Also check `S3_PUBLIC_URL`. Open an image URL directly to see the error. |

## Testing without AWS

`S3_ENDPOINT` points the driver at any S3-compatible server, such as LocalStack (`http://localhost:4566`). Set `STORAGE_DRIVER=s3` with test credentials and a test bucket to exercise the whole flow locally. Some S3-compatible servers are more lenient than AWS (the checksum problem above didn't show up on one), so step 8 against the real bucket is the real check.
