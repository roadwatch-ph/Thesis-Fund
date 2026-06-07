# GCash Contribution Tracking System

A modern, production-ready Next.js application for tracking weekly GCash contributions for a five-member organization from **June 7, 2026** through **December 27, 2026**.

## Features

- Admin dashboard with collection, paid, pending, and missing-payment statistics.
- Weekly payment matrix for all 30 Sundays in the contribution period.
- Per-member contribution summaries with progress, paid weeks, remaining balance, last payment, and next due date.
- Simple payment submission form with receipt upload.
- Google Drive integration for member-specific receipt folders inside the shared Google Drive folder (`1JU78o8NGnt-YrBp_7iR7d3WIEbx2AceL`).
- Google Sheets integration using `Members`, `Schedule`, and `Payments` sheets; the `Payments` sheet starts empty until members upload receipts, then Apps Script automatically writes Member, Due Date, Payment Method, Amount Paid, Reference Number, and Receipt columns.
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

| Member | Due Date | Payment Method | Amount Paid | Reference Number | Receipt |
| --- | --- | --- | --- | --- | --- |

## Google Drive folder structure

```text
Google Drive folder: 1JU78o8NGnt-YrBp_7iR7d3WIEbx2AceL
├── Jhon Lenard Dimaano
├── Prince Johnel Abe
├── Michael Orilla
├── Carmela Elaine Agrao
└── Darlene Grace Villanueva
```

Uploaded receipts are automatically stored inside the selected member's folder and renamed as `Member Name_Due Date.ext`, for example `Jhon Lenard Dimaano_2026-06-07.jpg`.

## Environment variables

Copy `.env.example` to `.env.local` and set. The app is preconfigured to use the deployed Google Apps Script web app URL below, and you can override it with `GOOGLE_APPS_SCRIPT_WEB_APP_URL` if you deploy a new script. Set `DISABLE_APPS_SCRIPT_BACKEND=true` only if you want to use service-account credentials directly from Next.js instead.

```bash
GOOGLE_APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/AKfycbxnaQnzv3VgLqxrxaAo4strOu1EOiEumW643WMhaSIGEXNaYxNG73v7Cgk1upEK0bL5RA/exec
# Optional direct Google API fallback:
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your-google-sheet-id
GOOGLE_DRIVE_ROOT_FOLDER_ID=1JU78o8NGnt-YrBp_7iR7d3WIEbx2AceL
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

After configuring the Apps Script URL (or direct Google API credentials), call this endpoint once to create the expected sheets, Drive folders, and seed only the member/schedule headers. Payment rows are not seeded, so the dashboard starts with ₱0 collected and no recent payments until uploads are submitted. If Google Apps Script or Google API credentials are unavailable, the same endpoint confirms the built-in local backend instead:

```bash
curl -X POST http://localhost:3000/api/verify
```

## Local fallback backend

The app is no longer just a static prototype when Google services are unavailable. If the Google Apps Script request fails and direct Google API credentials are not configured, submitted receipts are saved under member-specific folders in `public/uploads/receipts`, payment records are persisted in `.data/payments.json`, and admins can verify pending payments from the receipt modal on the dashboard. This makes the system runnable locally with only `npm run dev`.

## Production build

```bash
npm run build
npm start
```
