# Ghana Road Defect Monitoring

A mobile-friendly road image collection and quality-review system designed to prepare reliable Ghanaian road-defect data for later AI modelling.

## Features

- Collector ID and road-area capture
- Manual camera capture or road image upload
- Device GPS capture with accuracy and timestamp
- Final record review before submission
- Private image storage with Vercel Blob
- Metadata storage with Neon Postgres
- Password-protected administrator dashboard
- Submission totals and filters
- OpenStreetMap location overview
- Approve or reject quality-review workflow
- Local drone-video frame extraction
- Open-source Grounding DINO pothole candidate detection
- Human selection of AI candidates before upload

## Application routes

- `/` — project landing page
- `/collect` — collector submission form
- `/drone` — browser-based drone AI analysis
- `/admin/login` — administrator sign-in
- `/admin` — protected review dashboard
- `/api/health` — deployment configuration check

## Required environment variables

Copy `.env.example` to `.env.local` and configure:

```text
DATABASE_URL
BLOB_READ_WRITE_TOKEN
ADMIN_PASSWORD
SESSION_SECRET
```

The database table and indexes are created automatically on the first database operation.

## Drone AI pilot

The drone workflow samples up to 12 frames at two-second intervals. The Apache-2.0
Grounding DINO Tiny ONNX model runs in the reviewer's browser through
Transformers.js. The original video is not uploaded. Only candidate frames chosen
by a human reviewer are saved, and they enter the normal administrator review
queue with a pending status.

The model is downloaded from Hugging Face on first use and cached by the browser.
This pilot searches only for potholes and must not be treated as a final trained
road-defect model.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a browser.

## Deploy a preview to Vercel

```bash
vercel
```

Only promote to production after reviewing the preview:

```bash
vercel --prod
```

## Quality checks

```bash
npm run lint
npm run build
```
