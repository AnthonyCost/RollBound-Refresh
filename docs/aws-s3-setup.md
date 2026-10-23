# Moving cover images to AWS S3

The code for S3 is already in place. This guide covers the AWS setup you do by hand, and the settings that switch RollBound from local storage to S3.

## How it works

```
Browser ──1. "I want to upload a 2 MB PNG"──▶ RollBound API
        ◀──── signed S3 upload URL (10 min) ──
Browser ──2. PUT the file────────────────────▶ S3 bucket   (tagged state=pending)
Browser ──3. save campaign with the key──────▶ RollBound API ──checks the file is a real image,
                                                              retags it state=attached
Players ◀─4. load the cover──────────────────── CloudFront ◀── S3 bucket (private)
```

- **The file never passes through the API.** The browser uploads it straight to S3 with a presigned URL.
- **The signature covers the content type, the exact size, and the `state=pending` tag.** S3 rejects anything else, and the API caps the size at 5 MB.
- **The API checks the image before using it.** Before a campaign uses an uploaded file, the API reads its first bytes from S3 to confirm it really is a JPEG, PNG or WebP.
- **Abandoned uploads clean themselves up.** If someone uploads a cover but never saves the campaign, the file stays `pending`, and a lifecycle rule deletes it after a day.
- **Replaced and removed covers are deleted** right away.
- **The bucket stays private.** Players load covers through CloudFront.

The code for all of this is in `server/src/storage/s3.js`.

Every config file referenced below is in `infra/aws/`. Replace the placeholders as you go:

| Placeholder | Replace with |
| --- | --- |
| `YOUR_BUCKET_NAME` | Your bucket name, e.g. `rollbound-covers-prod` |
| `YOUR_ACCOUNT_ID` | Your 12-digit AWS account ID |
| `YOUR_DISTRIBUTION_ID` | The CloudFront distribution ID (from step 4) |
| `YOUR_APP_DOMAIN` | Where the site is hosted, e.g. `rollbound.example.com` |

## 1. Create the bucket

In the **S3** console, choose **Create bucket**:

- **Name:** a globally unique name, e.g. `rollbound-covers-prod`.
- **Region:** the one closest to your server, e.g. `us-east-2`. You'll put it in `AWS_REGION`.
- **Object Ownership:** ACLs disabled (the default).
- **Block all public access:** leave it **on**. CloudFront reads the bucket privately.
- **Default encryption:** SSE-S3 (the default) is fine.

Or with the AWS CLI:

```bash
aws s3api create-bucket --bucket YOUR_BUCKET_NAME --region us-east-2 \
  --create-bucket-configuration LocationConstraint=us-east-2
```

Leave out `--create-bucket-configuration` if you use `us-east-1`.

## 2. Allow browser uploads (CORS)

Browsers upload straight to the bucket, so the bucket must allow your site's origin. Edit `infra/aws/s3-cors.json`:

- Replace `YOUR_APP_DOMAIN` with your real domain.
- Keep `http://localhost:5173` if you want to test S3 from the dev server.

Then apply it:

```bash
aws s3api put-bucket-cors --bucket YOUR_BUCKET_NAME --cors-configuration file://infra/aws/s3-cors.json
```

In the console, the setting is under **Bucket → Permissions → Cross-origin resource sharing (CORS)**. The console wants only the array, so paste the `[ ... ]` part of `CORSRules`.

## 3. Delete abandoned uploads automatically

```bash
aws s3api put-bucket-lifecycle-configuration --bucket YOUR_BUCKET_NAME \
  --lifecycle-configuration file://infra/aws/s3-lifecycle.json
```

This deletes objects under `covers/` that are still tagged `state=pending` after one day. Covers in use are tagged `state=attached`, so the rule never touches them.

In the console, go to **Bucket → Management → Create lifecycle rule**:
1. Limit the rule to prefix `covers/` and the object tag `state` = `pending`.
2. Choose **Expire current versions of objects**, with **1** day.

## 4. Serve covers through CloudFront

1. Open **CloudFront → Create distribution**.
2. **Origin:** pick the bucket (`YOUR_BUCKET_NAME.s3.<region>.amazonaws.com`). Under **Origin access**, choose **Origin access control settings (recommended)** and create a new OAC.
3. **Viewer protocol policy:** Redirect HTTP to HTTPS.
4. **Cache policy:** `CachingOptimized`. Cover keys are unique and never change, so they can be cached for a long time.
5. Create the distribution, then note its **ID** and **domain** (like `d1234abcd.cloudfront.net`).
6. Allow CloudFront to read the bucket:
   1. Edit `infra/aws/s3-bucket-policy.json` with your bucket name, account ID and distribution ID.
   2. Paste it into **Bucket → Permissions → Bucket policy**, or run:

      ```bash
      aws s3api put-bucket-policy --bucket YOUR_BUCKET_NAME --policy file://infra/aws/s3-bucket-policy.json
      ```

The policy also refuses any request made without HTTPS.

Your `S3_PUBLIC_URL` will be `https://d1234abcd.cloudfront.net`, or a custom domain if you attach one to the distribution.

> **Without CloudFront:** you can turn off "Block public access" and allow public `s3:GetObject` on `covers/*`, then set `S3_PUBLIC_URL=https://YOUR_BUCKET_NAME.s3.<region>.amazonaws.com`. It's simpler, but slower, costlier at scale, and the bucket is public. CloudFront is recommended.

## 5. Give the server permission

The server needs exactly the permissions in `infra/aws/iam-policy.json`:
- put, tag, read and delete objects under `covers/`,
- list the bucket, so a missing file returns "not found" instead of "access denied".

Replace `YOUR_BUCKET_NAME`, then:

- **For local development:**
  1. In **IAM**, create a user such as `rollbound-dev`.
  2. Attach the policy as an inline policy.
  3. Create an **access key** for it, and put the key and secret in `server/.env`. That file is in `.gitignore`; never commit it.
- **In production:** give the server an **IAM role** with the policy (an EC2 instance profile, ECS task role, etc.) and leave the access keys out of `.env`. The AWS SDK finds role credentials on its own.

## 6. Switch RollBound to S3

Add these to `server/.env` (the same block is in `server/.env.example`):

```bash
STORAGE_DRIVER=s3
AWS_REGION=us-east-2
S3_BUCKET=YOUR_BUCKET_NAME
S3_PUBLIC_URL=https://d1234abcd.cloudfront.net

# Development only; use an IAM role in production.
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Restart the API (`npm run dev:server`). If anything required is missing, it refuses to start and names the missing setting. `UPLOAD_SECRET` and `UPLOAD_DIR` only apply to the local driver, so you can leave them out.

You don't need to change anything in the client or the database.

## 7. Move existing covers (if any)

Covers uploaded while using local storage live in `server/uploads/covers/`. Their keys are the same in S3, so copy them across and the campaigns keep working:

```bash
aws s3 sync server/uploads/covers s3://YOUR_BUCKET_NAME/covers
```

Copied files have no `state` tag, so the lifecycle rule leaves them alone.

## 8. Check it works

1. Sign in and create a campaign with a cover image.
2. In the browser's dev tools **Network** tab, the upload should be a `PUT` to `YOUR_BUCKET_NAME.s3...amazonaws.com` returning **200**.
3. The campaign page's cover should load from your CloudFront domain.
4. In the S3 console, the object under `covers/` should be tagged `state=attached`.
5. Edit the campaign and replace the cover. The old object should disappear from the bucket.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Upload fails in the browser with a **CORS** error | Your site's origin isn't in `s3-cors.json`, or `x-amz-tagging` is missing from `AllowedHeaders`. Origins must match exactly, including `https://` and the port. |
| Upload returns **403 SignatureDoesNotMatch** | The browser sent different headers than were signed. The client sends exactly the `headers` the API returns, so look for a proxy or extension that changes the request. A server clock that's minutes off also causes this. |
| Upload returns **403 AccessDenied** | The IAM user or role is missing `s3:PutObject` or `s3:PutObjectTagging`, or its policy names the wrong bucket. |
| Saving a campaign says **"That cover image upload was not found"** | The upload didn't finish, the file isn't a real image, or the server lacks `s3:GetObject`. |
| Server logs show **AccessDenied** when saving | The role is missing `s3:ListBucket`. Without it, S3 reports missing files as "access denied" instead of "not found". |
| Covers upload but don't display | `S3_PUBLIC_URL` is wrong, or the bucket policy doesn't name your CloudFront distribution. Open a cover URL directly to see the error. |

## Testing without AWS

`S3_ENDPOINT` points the driver at any S3-compatible server, such as LocalStack (`http://localhost:4566`). Set `STORAGE_DRIVER=s3` with test credentials and a test bucket to exercise the whole flow locally. The driver was tested this way against an S3-compatible gateway: presigned uploads, the signed size, type and tag checks, image verification, tagging, and deleting replaced covers.
