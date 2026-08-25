# ParkGA

ParkGA is a full-stack parking marketplace for finding, listing, booking, and paying for privately managed parking in Georgia. The application covers the customer, host, payment, notification, and administrative sides of a two-sided marketplace.

![ParkGA marketplace home](docs/parkga-home.png)

## Highlights

- Map-based parking discovery and detailed listing pages
- Supabase authentication, profiles, row-level data access, and image storage
- Host onboarding and listing creation workflows
- Stripe Checkout, connected-account onboarding, and webhook processing
- Booking confirmations and reminders through email and SMS
- Customer and host dashboards with bookings, reviews, and listing management
- Administrative views for marketplace operations
- Responsive Next.js interface with Mapbox and motion-enhanced interactions

## Architecture

| Area | Implementation |
| --- | --- |
| Web application | Next.js 16, React 19, TypeScript |
| Authentication and data | Supabase |
| Maps | Mapbox |
| Payments | Stripe and Stripe Connect |
| Email | Resend |
| SMS | Twilio |
| Styling | Tailwind CSS 4, Framer Motion |

The main marketplace records are profiles, parking spots, bookings, reviews, and uploaded spot images. Server routes own payment, webhook, onboarding, and notification operations so privileged credentials are never exposed to the browser.

## Run locally

Requirements:

- Node.js 20 or newer
- A Supabase project with the marketplace schema
- Mapbox, Stripe, Resend, and Twilio credentials for their respective integrations

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

Populate `.env.local` using the variable names in the example file. The repository does not include production credentials or customer records.

Scheduled reminder requests must include `Authorization: Bearer <CRON_SECRET>`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The automated suite covers booking validation and pricing, guest/host authorization decisions, Stripe webhook idempotency and conflict handling, and notification fan-out. CI runs it without production credentials.

The scripts in `scripts/` exercise payment, webhook, and notification integrations against developer accounts. Review their inputs before running them.

The repository screenshot was captured from a verified production build using placeholder public Supabase configuration. The previously configured Vercel URL is no longer an active deployment; use the local walkthrough in [`docs/demo-script.md`](docs/demo-script.md) until a replacement deployment is published.
