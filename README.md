# Ghana Road Defect Monitoring

A mobile-friendly road image collection and quality-review system designed to prepare reliable Ghanaian road-defect data for later AI modelling.

## Features

- Collector ID and road-area capture
- Road image preview and validation
- Device GPS capture with accuracy and timestamp
- Final record review before submission
- Private image storage with Vercel Blob
- Metadata storage with Neon Postgres
- Password-protected administrator dashboard
- Submission totals and filters
- OpenStreetMap location overview
- Approve or reject quality-review workflow

## Application routes

- `/` — project landing page
- `/collect` — collector submission form
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
