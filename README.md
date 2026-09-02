# Ghana Road Defect Monitoring

A mobile-friendly road image collection and quality-review system designed to prepare reliable Ghanaian road-defect data for later AI modelling.

## Features

- Persistent 12-digit collector ID generated automatically per browser/device
- Device manufacturer and model metadata when the browser makes it available
- Separate mobile camera capture and existing-photo upload actions
- Device GPS capture with accuracy and timestamp
- Final record review before submission
- Private image storage with Vercel Blob
- Metadata storage with Neon Postgres
- Password-protected administrator dashboard
- Submission totals and filters
- OpenStreetMap location overview
- Approve or reject quality-review workflow
- Administrator-managed maintenance status lifecycle
- Google Maps directions for verified GPS-backed submissions
- Public dashboard of non-rejected reports and maintenance progress
- Public map and directions for verified GPS-backed reports
- Public-data redaction for collector, device and unverified location details
- Recoverable administrator archive with submission restore
- Privacy-processed repair progress photos organised as before, in-progress and after
- Publicly scrollable road-repair image timelines
- Local drone-video frame extraction
- Open-source Grounding DINO pothole candidate detection
- Human selection of AI candidates before upload
- Local detection and blurring of people and road vehicles before storage
- SHA-256 duplicate prevention for previously submitted processed images

## Application routes

- `/` — project landing page
- `/collect` — collector submission form
- `/drone` — browser-based drone AI analysis
- `/reports` — public road-defect and maintenance-status dashboard
- `/admin/login` — administrator sign-in
- `/admin` — protected review dashboard
- `/admin/archives` — protected archive and restore view
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

## Privacy protection

Before a manual image is uploaded, the browser runs the open-source YOLOS Tiny
COCO detector and strongly blurs detected people, cars, buses, trucks,
motorcycles, and bicycles. The same privacy pass runs on drone candidate frames.
Only the processed image is submitted. If the privacy detector cannot complete,
the normal interface blocks the upload rather than storing the unprocessed image.

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
