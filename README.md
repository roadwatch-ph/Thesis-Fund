# GCash Contribution Tracking System

A modern, production-ready Next.js application for tracking weekly GCash contributions for a five-member organization from **June 7, 2026** through **December 27, 2026**.

## Features

- Admin dashboard with collection, paid, pending, and missing-payment statistics.
- Weekly payment matrix for all 30 Sundays in the contribution period.
- Per-member contribution summaries with progress, paid weeks, remaining balance, last payment, and next due date.
- Simple payment submission form with receipt upload.
- Google Drive integration for member-specific receipt folders.
- Google Sheets integration using `Members`, `Schedule`, and `Payments` sheets.
- Receipt viewer modal with Google Drive link and verification action.
- Responsive Stripe/Notion-inspired interface with white surfaces, blue accents, rounded cards, and soft shadows.

## Google Sheets database structure

### Members

| MemberID | MemberName | WeeklyContribution |
| --- | --- | --- |
| M001 | Juan Dela Cruz | 250 |
| M002 | Mark Anthony | 250 |
| M003 | Anne Villanueva | 250 |
| M004 | Paul Garcia | 250 |
| M005 | Lisa Reyes | 250 |

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
├── Juan Dela Cruz
├── Mark Anthony
├── Anne Villanueva
├── Paul Garcia
└── Lisa Reyes
```

Uploaded receipts are renamed as `MemberName_DueDate.ext`, for example `JuanDelaCruz_2026-06-21.jpg`.

## Environment variables

Copy `.env.example` to `.env.local` and set:

```bash
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your-google-sheet-id
GOOGLE_DRIVE_ROOT_FOLDER_ID=optional-existing-payment-receipts-folder-id
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Share the target Google Sheet and Drive folder with the service account email.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Preparing Google Sheets

After configuring credentials, call this endpoint once to create the expected sheets and seed the member/schedule headers:

```bash
curl -X POST http://localhost:3000/api/verify
```

## Production build

```bash
npm run build
npm start
```
