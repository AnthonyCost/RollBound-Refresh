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
Players ◀─4. load the image─────────────────────────── S3 bucket (or CloudFront in front of it)
```

- **The file never passes through the API.** The browser uploads it straight to S3 with a presigned URL.
- **The signature covers the content type, the exact size, and the `state=pending` tag.** S3 rejects anything else, and the API enforces each kind's size limit.
- **The API checks every image before using it.** It confirms the file is the right kind and was uploaded by the same user, then reads its first bytes from S3 to make sure it really is a JPEG, PNG or WebP.
- **Abandoned uploads clean themselves up.** If someone uploads an image but never saves it, the file stays `pending`, and a lifecycle rule deletes it after a day.
- **Replaced and removed images are deleted** right away. Deleting a character deletes its portrait.
- **Only the image folders can be read.** Players load images straight from the bucket (step 4A), or through CloudFront later (step 4B). Nobody can list the bucket, and only the server can upload or delete.

The code for all of this is in `server/src/storage/s3.js`.

If you add CloudFront (step 4B), you'll fill in two placeholders, both in `infra/aws/s3-bucket-policy.json`:

| Placeholder | Replace with |
| --- | --- |
| `YOUR_ACCOUNT_ID` | Your 12-digit AWS account ID (top-right account menu in the console) |
| `YOUR_DISTRIBUTION_ID` | The CloudFront distribution ID (from step 4B) |

The bucket is in **US East (N. Virginia) `us-east-1`**, and everything below uses that region. The commands assume the AWS CLI v2, signed in with an admin profile (`aws configure` or `aws sso login`). Every step also has a console route.

## 1. Create the bucket

In the **S3** console, choose **Create bucket**:

- **Bucket type:** General purpose.
- **Name:** `rollbound-refresh`. Bucket names are global; if it's taken, pick another and replace `rollbound-refresh` in `infra/aws/*.json` and below.
- **Region:** your chosen region. It goes in `AWS_REGION`.
- **Object Ownership:** ACLs disabled (the default).
- **Block all public access:** leave it **on** for now. Step 4A turns two of its settings off so the image folders can be read.
- **Default encryption:** SSE-S3 (the default) is fine.

Or with the CLI:

```bash
aws s3api create-bucket --bucket rollbound-refresh --region us-east-1
```

(Other regions also need `--create-bucket-configuration LocationConstraint=<region>`; `us-east-1` doesn't.)

## 2. Allow browser uploads (CORS)

Browsers upload straight to the bucket, so the bucket must allow the site's origin. `infra/aws/s3-cors.json` allows `http://localhost:5173` (the dev server), `https://rollbound.com` and `https://www.rollbound.com`. Origins must match exactly, so if the site ever runs anywhere else (a staging subdomain, another port), add it here and re-run the command.

```bash
aws s3api put-bucket-cors --bucket rollbound-refresh --cors-configuration file://infra/aws/s3-cors.json
```

In the console it's under **Bucket → Permissions → Cross-origin resource sharing (CORS) → Edit**. The console takes only the list of rules, not the file's `{ "CORSRules": ... }` wrapper (pasting the whole file gives "The XML you provided was not well-formed"). Replace everything in the box with:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://rollbound.com", "https://www.rollbound.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type", "x-amz-tagging"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## 3. Delete abandoned uploads automatically

This rule deletes any image still tagged `state=pending` a day after it was uploaded: one someone picked but never saved, whether it's a cover, avatar or portrait. Images in use are tagged `state=attached`, so the rule never touches them.

1. In the **S3** console, open the `rollbound-refresh` bucket and choose the **Management** tab.
2. Under **Lifecycle rules**, choose **Create lifecycle rule**.
3. **Lifecycle rule name:** `expire-abandoned-image-uploads`.
4. **Choose a rule scope:** select **Limit the scope of this rule using one or more filters**.
5. **Filter type:**
   - **Prefix:** leave it empty, so the rule covers all three image folders.
   - **Object tags:** choose **Add tag**, then enter **Key** `state` and **Value** `pending` (lowercase, no spaces).
   - **Object size:** leave both boxes unchecked.
6. **Lifecycle rule actions:** check only **Expire current versions of objects**.
7. **Expire current versions of objects:** set **Days after object creation** to `1`.
8. Choose **Create rule**. The rule should show as **Enabled** in the list, with the scope `state=pending`.

S3 runs lifecycle rules about once a day, so an abandoned upload can linger for a day or two before it's gone. That's expected.

If the console asks you to acknowledge that the rule applies to **all objects in the bucket**, stop: the tag filter didn't get added. Go back to step 5.

Or with the CLI: `aws s3api put-bucket-lifecycle-configuration --bucket rollbound-refresh --lifecycle-configuration file://infra/aws/s3-lifecycle.json`

## 4. Let browsers load the images

There are two ways. **4A** serves images straight from the bucket: it needs no CloudFront and works on a new AWS account. **4B** puts CloudFront in front of the bucket, which keeps the bucket fully private and caches images near players. Start with 4A; you can move to 4B any time, because RollBound stores image keys, not full URLs, and every image switches over as soon as `S3_PUBLIC_URL` changes.

### 4A. Straight from the bucket (no CloudFront)

The three image folders become publicly readable: anyone with an image's link can view it. Each image's name is random and unguessable, nobody can list the bucket, and only the server can upload or delete.

1. **Block public access:** in **Bucket → Permissions → Block public access (bucket settings) → Edit**, uncheck **Block all public access**, then check the first two boxes again (the ones about **access control lists (ACLs)**). Leave the two boxes about **bucket and access point policies** unchecked. Save, and type `confirm` when asked.
2. **Bucket policy:** in **Bucket → Permissions → Bucket policy → Edit**, replace everything with the policy below (nothing to fill in). It lets anyone read the three image folders and refuses any request made without HTTPS:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowPublicReadOfImages",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": [
           "arn:aws:s3:::rollbound-refresh/covers/*",
           "arn:aws:s3:::rollbound-refresh/avatars/*",
           "arn:aws:s3:::rollbound-refresh/portraits/*"
         ]
       },
       {
         "Sid": "DenyInsecureTransport",
         "Effect": "Deny",
         "Principal": "*",
         "Action": "s3:*",
         "Resource": [
           "arn:aws:s3:::rollbound-refresh",
           "arn:aws:s3:::rollbound-refresh/*"
         ],
         "Condition": {
           "Bool": {
             "aws:SecureTransport": "false"
           }
         }
       }
     ]
   }
   ```

   Or with the CLI:

   ```bash
   aws s3api put-bucket-policy --bucket rollbound-refresh --policy file://infra/aws/s3-bucket-policy-public.json
   ```

   If saving fails with **Access denied**, public policies are also blocked for your whole account: check **S3 → Block Public Access settings for this account**.

3. Your `S3_PUBLIC_URL` is the bucket's own address: `https://rollbound-refresh.s3.us-east-1.amazonaws.com`.

The CORS rules from step 2 already allow `GET` from your site, which the PDF export needs to read portraits.

### 4B. Through CloudFront (once your account can create distributions)

New AWS accounts sometimes can't create a distribution until AWS verifies them; 4A works meanwhile. When you switch from 4A, do steps 1 to 7 below first, then turn **Block all public access** back on (all four boxes), and change `S3_PUBLIC_URL`.

1. Open **CloudFront → Create distribution**. If the console asks you to choose a pricing plan, the free or pay-as-you-go option is plenty for this site.
2. **Origin:** choose **Amazon S3** and pick `rollbound-refresh`. Choose the option that keeps the bucket private and grants CloudFront access: **Origin access control (OAC)**, often shown as "Allow private S3 bucket access to CloudFront". Don't pick the legacy OAI or the bucket's website endpoint (OAC doesn't work with website endpoints).
3. **Recommended settings:** the wizard's recommended cache settings for an S3 origin use `CachingOptimized`, which suits these images (each key is unique and never changes). Make sure viewers are redirected from HTTP to HTTPS.
4. **Security:** web application firewall (WAF) protection is optional; you can skip it.
5. Create the distribution, then note its **ID** (like `E1ABCDEF2GHIJK`) and **domain** (like `d1234abcd.cloudfront.net`). It takes a few minutes to deploy.
6. **Bucket policy:** the wizard may add a policy to the bucket for you. Replace it with the stricter one in `infra/aws/s3-bucket-policy.json`, which lets CloudFront read only the three image folders and refuses any request made without HTTPS:
   1. In **Bucket → Permissions → Bucket policy → Edit**, replace everything with the policy below, swapping in your 12-digit account ID for `YOUR_ACCOUNT_ID` and the distribution ID (like `E1ABCDEF2GHIJK`) for `YOUR_DISTRIBUTION_ID`:

      ```json
      {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Sid": "AllowCloudFrontToReadImages",
            "Effect": "Allow",
            "Principal": {
              "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": [
              "arn:aws:s3:::rollbound-refresh/covers/*",
              "arn:aws:s3:::rollbound-refresh/avatars/*",
              "arn:aws:s3:::rollbound-refresh/portraits/*"
            ],
            "Condition": {
              "StringEquals": {
                "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
              }
            }
          },
          {
            "Sid": "DenyInsecureTransport",
            "Effect": "Deny",
            "Principal": "*",
            "Action": "s3:*",
            "Resource": [
              "arn:aws:s3:::rollbound-refresh",
              "arn:aws:s3:::rollbound-refresh/*"
            ],
            "Condition": {
              "Bool": {
                "aws:SecureTransport": "false"
              }
            }
          }
        ]
      }
      ```

   2. Or with the CLI, put the two IDs into `infra/aws/s3-bucket-policy.json` and run:

      ```bash
      aws s3api put-bucket-policy --bucket rollbound-refresh --policy file://infra/aws/s3-bucket-policy.json
      ```

7. **CORS for reading images back:** the app fetches a character's portrait to put it into the exported PDF sheet. In the distribution, open **Behaviors**, edit the default behavior, and set:
   - **Origin request policy:** `CORS-S3Origin`
   - **Response headers policy:** `CORS-With-Preflight`

   The bucket's CORS rules from step 2 already allow `GET` from your site.

Your `S3_PUBLIC_URL` is `https://` plus the distribution's domain, or `https://images.rollbound.com` once you do step 4C.

### 4C. Optional: serve images from images.rollbound.com (with CloudFront)

Images work fine from the `cloudfront.net` address; this only makes the URLs your own. RollBound stores image keys, not full URLs, so you can do this any time: existing images switch over as soon as `S3_PUBLIC_URL` changes.

1. **Certificate:** in **AWS Certificate Manager**, make sure the region is **US East (N. Virginia) `us-east-1`** (CloudFront only uses certificates from there; it's also your bucket's region). Request a public certificate for `images.rollbound.com` with **DNS validation**, and add the CNAME record it gives you at your DNS provider. Wait until it shows **Issued**.
2. **Distribution:** edit the distribution's settings, add `images.rollbound.com` as an **alternate domain name**, and choose that certificate.
3. **DNS:** at your DNS provider, point `images.rollbound.com` at the distribution: a **CNAME** to `d1234abcd.cloudfront.net`, or an **alias A/AAAA** record if the domain is in Route 53.
4. Set `S3_PUBLIC_URL=https://images.rollbound.com` and restart the API.

Use a subdomain rather than `rollbound.com` itself, which the app will use. (Without CloudFront, S3 can't serve a custom domain over HTTPS, so this needs 4B.)

## 5. Give the server permission

The server needs exactly the permissions in `infra/aws/iam-policy.json` (already filled in for `rollbound-refresh`):
- put, tag, read and delete objects under `covers/`, `avatars/` and `portraits/`,
- list the bucket, so a missing file returns "not found" instead of "access denied".

**For local development:**
1. In **IAM → Users**, create a user such as `rollbound-dev`. It doesn't need console access.
2. On the user, choose **Add permissions → Create inline policy → JSON**, replace everything in the editor with the policy below (nothing to fill in), and name it `rollbound-images`:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "ManageUploadedImages",
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:PutObjectTagging", "s3:GetObject", "s3:DeleteObject"],
         "Resource": [
           "arn:aws:s3:::rollbound-refresh/covers/*",
           "arn:aws:s3:::rollbound-refresh/avatars/*",
           "arn:aws:s3:::rollbound-refresh/portraits/*"
         ]
       },
       {
         "Sid": "MissingImagesReturn404Not403",
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::rollbound-refresh",
         "Condition": { "StringLike": { "s3:prefix": ["covers/*", "avatars/*", "portraits/*"] } }
       }
     ]
   }
   ```

3. Under **Security credentials**, create an **access key**. When asked for a use case, choose **Application running outside AWS** (or **Local code**); the console suggests alternatives, but a scoped key is fine for a dev machine.
4. Put the key ID and secret in `server/.env` (step 6). That file is in `.gitignore`; never commit it. If a key ever leaks, deactivate it in IAM and create a new one.

**In production:** if rollbound.com runs on AWS (EC2, ECS, App Runner, Lambda), give the server an **IAM role** with the same policy and leave the access keys out of `.env`; the AWS SDK finds role credentials on its own. On a host outside AWS (Render, Fly.io, a VPS), create a separate IAM user such as `rollbound-prod` with the same inline policy, and set its keys as that host's environment variables. Don't reuse the dev key.

## 6. Switch RollBound to S3

In `server/.env`, change `STORAGE_DRIVER` and add the S3 settings (the same block is commented out in `server/.env.example`):

```bash
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
S3_BUCKET=rollbound-refresh
# The bucket's address (step 4A), or your CloudFront domain (step 4B).
S3_PUBLIC_URL=https://rollbound-refresh.s3.us-east-1.amazonaws.com

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
2. In the browser's dev tools **Network** tab, the upload should be a `PUT` to `rollbound-refresh.s3.us-east-1.amazonaws.com` returning **200**.
3. The campaign page's cover should load from `S3_PUBLIC_URL` (the bucket's address, or your CloudFront domain).
4. In the S3 console, the object under `covers/` should be tagged `state=attached`.
5. Edit the campaign and replace the cover. The old object should disappear from the bucket.
6. Set a profile image on the Account page, and a portrait from a character sheet. They should land under `avatars/` and `portraits/`.
7. Export a character sheet as a PDF. The portrait should be in it (this checks the `GET` in step 2's CORS rules, and step 4B.7 with CloudFront).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Upload fails in the browser with a **CORS** error | Your site's origin isn't in `s3-cors.json` (e.g. you're on `www.` but only the bare domain is listed), or `x-amz-tagging` is missing from `AllowedHeaders`. Origins must match exactly, including `https://` and the port. |
| Upload returns **400** mentioning a **checksum** (e.g. `BadDigest`) | The upload URL was signed with a checksum. `s3.js` sets `requestChecksumCalculation: 'WHEN_REQUIRED'` to prevent this; check that it's still there. |
| Upload returns **403 SignatureDoesNotMatch** | The browser sent different headers than were signed. The client sends exactly the `headers` the API returns, so look for a proxy or extension that changes the request. A server clock that's minutes off also causes this. |
| Upload returns **403 AccessDenied** | The IAM user or role is missing `s3:PutObject` or `s3:PutObjectTagging`, or its policy names a different bucket. |
| Saving says **"That image upload was not found"** | The upload didn't finish, the file isn't a real image, or the server lacks `s3:GetObject` on that prefix. |
| Server logs show **AccessDenied** when saving | The role is missing `s3:ListBucket`. Without it, S3 reports missing files as "access denied" instead of "not found". |
| The PDF sheet exports without the portrait | The image request isn't getting CORS headers. Without CloudFront, check that step 2's rules allow `GET` from your site's origin. With CloudFront, check the origin request and response headers policies in step 4B.7. |
| Images upload but don't display (**403**) | Straight from the bucket: the public policy from step 4A is missing, or a **Block public access** box about policies is still checked (for the bucket or the account). With CloudFront: the bucket policy doesn't name your account and distribution IDs, or the distribution uses OAI instead of OAC. Also check `S3_PUBLIC_URL`, and open an image URL directly to see the error. |

## Testing without AWS

`S3_ENDPOINT` points the driver at any S3-compatible server, such as LocalStack (`http://localhost:4566`). Set `STORAGE_DRIVER=s3` with test credentials and a test bucket to exercise the whole flow locally. Some S3-compatible servers are more lenient than AWS (the checksum problem above didn't show up on one), so step 8 against the real bucket is the real check.
