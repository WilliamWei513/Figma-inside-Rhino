# Netlify Embed Repo Template

This document contains a ready-to-push repo template and instructions for the **Netlify + Netlify Function -> S3 `embed.json`** workflow. Use this to host a clean iframe wrapper page and let your Figma plugin (or any script) POST the new Figma embed `src` to a protected endpoint that updates `embed.json` in S3. The static site loads `embed.json` at runtime and sets the iframe `src` — no site rebuild required.

---

## Repo structure (what's included below)

```
netlify-embed-repo/
├─ index.html
├─ netlify.toml
├─ package.json
├─ netlify/functions/update-embed.js
├─ README.md
└─ .gitignore
```

---

## `index.html`

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Contractor Viewer</title>
  <style>
    html,body{height:100%;margin:0;background:#fff}
    #frame{width:100%;height:100vh;border:0}
    #error{position:fixed;left:12px;top:12px;padding:8px;background:#fff;border:1px solid #eee;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.08);display:none}
  </style>
</head>
<body>
  <div id="error"></div>
  <iframe id="frame" src="" allowfullscreen></iframe>

  <script>
    // Set this to your public embed.json URL (the function will write to S3 at this path)
    const EMBED_JSON_URL = "https://your-bucket.s3.amazonaws.com/embed.json"; // <-- replace in Netlify site settings or edit after deploy

    async function loadEmbed(){
      try{
        const r = await fetch(EMBED_JSON_URL, { cache: 'no-store' });
        if(!r.ok) throw new Error('embed.json not found (status ' + r.status + ')');
        const j = await r.json();
        if (!j || !j.src) throw new Error('embed.json missing src');
        document.getElementById('frame').src = j.src;
      } catch(e) {
        console.error(e);
        const err = document.getElementById('error');
        err.style.display = 'block';
        err.innerText = 'Viewer error: ' + e.message;
      }
    }

    loadEmbed();
    // Optional: poll periodically so contractor sees updates without manual refresh
    setInterval(loadEmbed, 60_000);
  </script>
</body>
</html>
```

---

## `netlify/functions/update-embed.js` (Netlify Function)

```js
// update-embed.js
// Netlify serverless function that writes embed.json to S3
// Requires env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET, UPDATE_SECRET

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const CORS_HEADERS = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-update-secret',
});

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

exports.handler = async function(event) {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS(origin), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS(origin), body: 'Method Not Allowed' };
  }

  try {
    const headers = event.headers || {};
    const provided = headers['x-update-secret'] || headers['X-Update-Secret'] || headers['x-secret'] || '';
    if (!process.env.UPDATE_SECRET || provided !== process.env.UPDATE_SECRET) {
      return { statusCode: 401, headers: CORS_HEADERS(origin), body: 'Unauthorized' };
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.src) return { statusCode: 400, headers: CORS_HEADERS(origin), body: 'Missing src' };

    const payload = JSON.stringify({ src: body.src, updatedAt: new Date().toISOString() });

    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: 'embed.json',
      Body: payload,
      ContentType: 'application/json',
      ACL: 'public-read'
    }));

    const publicUrl = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/embed.json`;
    return { statusCode: 200, headers: CORS_HEADERS(origin), body: JSON.stringify({ ok: true, url: publicUrl }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: CORS_HEADERS(origin), body: String(err) };
  }
};
```

---

## `netlify.toml`

```toml
[build]
  functions = "netlify/functions"
  command = "npm install"

[dev]
  functions = "netlify/functions"
```

---

## `package.json`

```json
{
  "name": "netlify-embed-repo",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0"
  }
}
```

---

## `.gitignore`

```gitignore
node_modules/
.env
.DS_Store
```

---

## `README.md` (quick usage summary)

```md
# Netlify Embed Repo Template

Short: host `index.html` on Netlify; the page fetches `embed.json` (in S3). A Netlify Function `update-embed` accepts a POST with `{ src: "<figma-embed-src>" }` and writes `embed.json` in S3. Use your Figma plugin (or script) to POST the new `src` whenever you sync.

## Steps (high level)
1. Create an S3 bucket and allow public read for `embed.json` (or use CloudFront/CORS as needed).
2. Create an IAM user with `PutObject` on that bucket and record its keys.
3. Create a Git repo with these files and push to GitHub (or push local files directly to Netlify via drag & drop).
4. Create a Netlify site for the repo. In Netlify site settings, add env vars:
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY
   - AWS_REGION (e.g. us-east-1)
   - S3_BUCKET (your bucket name)
   - UPDATE_SECRET (random secret string)  
   - ALLOWED_ORIGIN (optional; defaults to '*')
5. Deploy the site. Netlify will install dependencies and publish the function at `/.netlify/functions/update-embed`.
6. Write an initial `embed.json` to S3:
   ```bash
   echo '{"src":"https://www.figma.com/embed?embed_host=share&..."}' > embed.json
   aws s3 cp embed.json s3://your-bucket/embed.json --acl public-read --content-type application/json
   ```
7. In your Figma plugin or external sync script, POST the new `src` to the Netlify function (include `x-update-secret` header).
8. Your `index.html` will fetch the updated `embed.json` and set the iframe `src` — contractor refresh gets the update.

## Security notes
- Do NOT include `UPDATE_SECRET` in a public plugin. For MVP/internal use it's acceptable but for production use move update logic to a backend that stores secrets securely.
- Consider scoping the IAM user to only `s3:PutObject` on the single object key `arn:aws:s3:::your-bucket/embed.json`.
```

---

## What I put in this template

- A minimal `index.html` that runtime-fetches `embed.json` from S3 and sets an iframe `src`.
- A Netlify function `update-embed.js` that accepts POST (with `x-update-secret`) and writes `embed.json` to your S3 bucket.
- `netlify.toml` and `package.json` so Netlify will install dependencies and build functions.
- A README with usage notes and the short steps you'll need.

---

## Next steps / options
- If you prefer **GitHub-based** storage (update `embed.json` by committing to a repo), I can provide an alternate function that uses the GitHub API (Octokit) instead of S3.
- If you want the Figma plugin snippet that POSTs the `src` securely, I can add a small UI snippet (note: don't hardcode secrets in distributed plugins).


---

_End of template. Open this document and copy the file blocks into a new git repo, or download the files directly from the canvas._

