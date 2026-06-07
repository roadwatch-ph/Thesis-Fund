# GCash Contribution Tracking System

A modern, production-ready Next.js application for tracking weekly GCash contributions for a five-member organization from **June 7, 2026** through **December 27, 2026**.

## Features

- Admin dashboard with collection, paid, pending, and missing-payment statistics.
- Weekly payment matrix for all 30 Sundays in the contribution period.
- Per-member contribution summaries with progress, paid weeks, remaining balance, last payment, and next due date.
- Simple payment submission form with receipt upload.
- Google Drive integration for member-specific receipt folders.
- Google Sheets integration using `Members`, `Schedule`, and `Payments` sheets; the `Payments` sheet starts empty until members upload receipts.
- Receipt viewer modal with Google Drive link and verification action.
- Responsive Stripe/Notion-inspired interface with white surfaces, blue accents, rounded cards, and soft shadows.

## Google Sheets database structure

### Members

| MemberID | MemberName | WeeklyContribution |
| --- | --- | --- |
| M001 | Jhon Lenard Dimaano | 100 |
| M002 | Prince Johnel Abe | 100 |
| M003 | Michael Orilla | 100 |
| M004 | Carmela Elaine Agrao | 100 |
| M005 | Darlene Grace Villanueva | 100 |

### Schedule

| DueDate |
| --- |
| 2026-06-07 through 2026-12-27, every Sunday |

### Payments

| Timestamp | MemberName | DueDate | AmountPaid | ReferenceNumber | ReceiptLink | Status |
| --- | --- | --- | --- | --- | --- | --- |

## Google Drive folder structure

```text
Payment Receipts
├── Jhon Lenard Dimaano
├── Prince Johnel Abe
├── Michael Orilla
├── Carmela Elaine Agrao
└── Darlene Grace Villanueva
```

Uploaded receipts are renamed as `MemberName_DueDate.ext`, for example `JhonLenardDimaano_2026-06-21.jpg`.

## Environment variables

Copy `.env.example` to `.env.local` and set. The app is preconfigured to use the deployed Google Apps Script web app URL below, and you can override it with `GOOGLE_APPS_SCRIPT_WEB_APP_URL` if you deploy a new script. Set `DISABLE_APPS_SCRIPT_BACKEND=true` only if you want to use service-account credentials directly from Next.js instead.

```bash
GOOGLE_APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/AKfycbxnaQnzv3VgLqxrxaAo4strOu1EOiEumW643WMhaSIGEXNaYxNG73v7Cgk1upEK0bL5RA/exec
# Optional direct Google API fallback:
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your-google-sheet-id
GOOGLE_DRIVE_ROOT_FOLDER_ID=optional-existing-payment-receipts-folder-id
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

When using the Apps Script backend, make sure the script is deployed as a web app with access to the target Google Sheet and Drive folders. When using the direct Google API fallback, share the target Google Sheet and Drive folder with the service account email.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Preparing Google Sheets

After configuring the Apps Script URL (or direct Google API credentials), call this endpoint once to create the expected sheets, Drive folders, and seed only the member/schedule headers. Payment rows are not seeded, so the dashboard starts with ₱0 collected and no recent payments until uploads are submitted:

```bash
curl -X POST http://localhost:3000/api/verify
```

## Production build

```bash
npm run build
npm start
```
