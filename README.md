# The Miller Group website

A static website for GitHub Pages, with a Supabase back end for leads (CRM), landing pages, listings, blog posts and testimonials.

## What's in the folder
- `index.html` plus 17 pages: buy, sell, home value, commercial, development, communities, listings, about, testimonials, blog, contact, and four legal pages
- `lp/` landing page template (one file serves every landing page)
- `admin/` private admin app: login, CRM, landing page builder, listings, blog, testimonials, SEO tools
- `search/` home search for clients plus the agent tools (Agent tab) for every agent at the brokerage
- `server/` two small functions for Vercel: live REcolorado listings and the agent AI assistant (GitHub Pages can’t run these)
- `assets/config.js` the one file with your settings
- `assets/layout.js` the shared menu and footer (edit once, every page updates)
- `supabase/schema.sql` the database setup, and `supabase/agent-tools.sql` for the home search and agent tools
- `sitemap.xml`, `robots.txt`, `404.html`

## Setup (about 30 minutes)

### 1. Put the site on GitHub
1. Upload everything in this folder to your `TheMillerGroup` repository (keep the folders, and put `index.html` at the top level).
2. Settings, Pages, Build and deployment: Deploy from a branch, `main`, `/ (root)`.
3. The site goes live at https://brandon-miller-oss.github.io/TheMillerGroup/ and the admin at .../TheMillerGroup/admin/
4. When you have your domain, add it under Settings, Pages, Custom domain, point your DNS as GitHub instructs, then change `SITE_URL` in `assets/config.js` to the new address and regenerate the sitemap in Admin, SEO.

### 2. Create the database (free)
1. Sign up at supabase.com and create a project.
2. SQL Editor, New query, paste all of `supabase/schema.sql`, Run.
3. Authentication, Users, Add user: your email and a strong password.
4. SQL Editor, run (with your email):
   `insert into public.admins (user_id) select id from auth.users where email = 'you@yourdomain.com';`
5. Authentication, Sign In / Providers: turn OFF "Allow new users to sign up".
6. Project Settings, API: copy the Project URL and the `anon` public key.
7. Authentication, URL Configuration: set Site URL to your site address and add `https://brandon-miller-oss.github.io/TheMillerGroup/admin/` (and your custom domain's `/admin/` later) under Redirect URLs, so password reset emails work.

### 3. Connect the site
Open `assets/config.js` and fill in:
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` from step 2
- `SITE_URL` (your final web address, no trailing slash)
- `NOTIFY_EMAIL`, `PHONE`, `PHONE_TEL`, `LICENSE_TEXT`
- `GA4_ID` and `META_PIXEL_ID` when you run ads

Commit the change. Then visit `/admin/` and sign in.

The anon key is meant to be public. The SQL policies are what protect your data: visitors can only add new leads and read items you mark live, and only admin users can read or change anything else. Never put the `service_role` key in this site.

## Home search and agent tools (`search/`)

Clients search homes, save shortlists and searches, request showings, and message their agent. Every agent gets the same tools in the Agent tab: contacts, buyer and seller pipelines, tasks, inbox, showing days, open houses with a sign-in sheet, CMAs, marketing graphics, off-market listings, Market pulse, GCI tracker, and the AI assistant.

Who sees what:

| | Clients | Each agent | You (broker) |
|---|---|---|---|
| Listings, published off-market listings, open houses, Miller Picks, Team page | Yes | Yes | Yes |
| A client’s shortlists, searches, showing requests, messages | Their own | Their assigned clients | All |
| Contacts, tasks, deals, CMAs, GCI goals | No | Their own | Your own, plus any agent’s through Settings, Broker view |

### Demo mode (testing)
`DEMO_MODE: true` in `assets/config.js` lets anyone open **Search homes → Agent** without signing in. They see sample clients, transactions, and office content with broker access turned on, and nothing they change is saved. Signed-in agents always see their real data. Set `DEMO_MODE: false` before launch.

The website admin at `/admin/` always requires a login, because it holds real leads.

### Setup
1. Run `supabase/agent-tools.sql` in the Supabase SQL Editor (after `schema.sql`).
2. Supabase, Authentication, Sign In / Providers: turn ON "Allow new users to sign up" and keep Email enabled, so clients can sign in with an emailed link. Your admin data stays protected: only users in the `admins` table can read leads or anything in `/admin/`.
3. Authentication, URL Configuration: add your site’s `/search/` address to Redirect URLs (for example `https://brandon-miller-oss.github.io/TheMillerGroup/search/`).
4. Open `/search/`, tap Sign in, and use the emailed link. You’re in `admins` already, so the Agent tab appears. Go to Settings and fill in your profile with the link name `brandon` (this matches `DEFAULT_AGENT_SLUG` in `assets/config.js`; clients who arrive without an agent’s link go to you).

### Adding an agent
1. The agent opens `/search/` and signs in once with their email.
2. You open Agent, Team, Add agent, and enter that email.
3. They reload, open Settings, fill in their profile and pick a link name (for example `sara`).
4. They share their personal link, like `/search/?agent=sara`. Clients who sign in through it are assigned to them.

To remove an agent, open Team, Edit on their card, Remove. Their clients stay assigned to them until you reassign; for now, reassign by editing `agentId` on the client’s `boards/<client id>` row in Supabase.

Showing requests from the home search also land in Admin, Leads, with source "home-search", so the website CRM stays complete.

### Live listings and AI (optional until your feed is approved)
Without these, search runs on sample listings and the AI buttons say they aren’t available.

1. Import this repo into Vercel and set the Root Directory to `server`.
2. Add the settings from `server/.env.example` in Vercel, Settings, Environment Variables. `ALLOWED_ORIGINS` must include your site’s address (for GitHub Pages: `https://brandon-miller-oss.github.io`).
3. Put the two addresses in `assets/config.js`: `IDX_ENDPOINT` (`https://<your-vercel-app>/api/idx`) and `AI_ENDPOINT` (`https://<your-vercel-app>/api/ai`).

The REcolorado feed comes through Bridge Interactive, requested from your REcolorado CONNECT dashboard. Start with an IDX feed for the public search. Before going live, replace the disclaimer in `search/index.html` (search for `DISCLAIMER`) with REcolorado’s required wording and check the display rules in the current REcolorado Data Policy.

### Office tools (`search/office.js`)
Under Agent home, Office and Prospecting:

- **Transactions:** contract dates entered from the signed contract (each date shows the Road to Closed recommended timing, like "18–21 days after MEC"), a required-document checklist that follows the side (buyer, listing, or both, from the training guide) with links to signed copies, deadline alerts on Agent home, and Submit for review. You approve or request changes from **Broker review**.
- **Company hub:** policies, forms, training, and announcements (as links to your files), with "must read" tracking. You also set the **commission plan** (per-transaction fee, E&O, monthly fee, yearly cap) and **Connections** (eSign, MLS, and training links) here.
- **My income:** each agent’s commission, brokerage fees, referral fees, net, and expenses for the year, with CSV export. You also see fee totals by agent.
- **Referrals:** clients sent out or received, fee percent, expected fee, and status.
- **Follow-up emails:** home anniversaries (from closed transactions linked to a contact), birthdays, and check-ins, with editable templates. Contacts marked "Do not contact" are always skipped.
- **Preferred partners** and **Brand library:** you add them; every agent sees them. Partners show a RESPA reminder and flag affiliated businesses.
- **Contract clauses:** agent-only library of the training guide’s recommended verbiage (appraisal shortfall, escalation with a cap, inspection waiver, commission adjustment, personal belongings, buyer letters, recording devices, ILC, due diligence documents) with Copy buttons and a reminder to review with the Employing Broker.
- **Recruiting:** your prospect pipeline (broker only).
- **Prospecting:** Matching clients (finds clients whose saved searches, loved homes, or budgets fit a listing, and messages them), Likely to sell, Import contacts (CSV), folders on contacts and transactions, and a Get started checklist for new agents.

### CMAs
Agents start a CMA from **CMAs → New CMA**, from **Create CMA** on any seller in the Sellers pipeline, or from a listing. The app picks the five closest comps and applies **automatic adjustments** for size, bedrooms, bathrooms, age, and active listings (which haven’t sold yet), using the rates you set under **CMAs → Adjustment rates** (broker only). Agents add their own adjustments for things the app can’t see, like condition or a garage. Comps that need large adjustments (more than 15% net or 25% gross) are flagged.

**Seller report (PDF)** makes a branded report with the price range, comps table, adjustment details, a map of the comps, the agent’s summary, and a not-an-appraisal disclaimer. Agents must confirm they reviewed it before downloading or emailing it. With email connected, it’s sent as an attachment; otherwise Send downloads the PDF and opens the agent’s email app. Closed sales replace active listings as comps once the MLS feed is connected.

### Listing presentations
**Listing presentations** builds a branded PDF for seller appointments, in a data-first layout: cover, agent profile with pledge and client reviews, why The Miller Group, the market right now, property summary, a map and table of comps, a page per comp (with MLS photos once the feed is connected), side-by-side comparison, status comparison and averages, price vs. days on market and price vs. size charts, pricing analysis, pricing strategy, estimated net proceeds at the low, suggested, and high price, home prep checklist, marketing plan, selling process, incentives and offers, questions to ask any agent (answered from the agent’s stats), and next steps. Agents choose sections and marketing items for each seller.

- Start one from the tile, from **Presentation** on a seller, or from **Listing presentation** on a CMA.
- Each agent fills in **My presentation profile** (title, headshot link, bio, pledge, stats, client reviews, and their usual listing fee for net sheets).
- The broker updates **Market stats** each month (median prices, days on market, months of supply, concessions, expired listings, mortgage rate, and source). They start with October 2026 REcolorado figures.
- Pages from the Road to Closed training: **Before we begin** (disclosures before any confidential discussion, the listing agreement, and the personal belongings, buyer letters, and recording-device choices), **Walk-through and showing rules**, **Recommended vendors** (at least three inspectors, cleaners, handypeople, and carpet cleaners from Preferred partners, alphabetical), and **After you accept an offer** (inspection and appraisal options, wire fraud warning).
- Each presentation has an agent-only **appointment checklist** (disclosures first, Exclusive Right-to-Sell, packet contents, pre-listing documents). It never prints in the PDF.
- The net sheet uses Colorado items: owner’s title policy, closing fee, HOA letter and transfer fees, and property taxes prorated because Colorado taxes are paid a year behind. Fees and buyer’s agent compensation are shown as negotiable.

### Buyer presentations
**Buyer presentations** builds the buyer-consultation kit from the Road to Closed training as a branded PDF: cover, agent profile, how we work together (Definitions of Working Relationships and Affiliated Business disclosures first, then the Exclusive Right-to-Buy with negotiable compensation), the market for buyers, buying power (payments at three prices, payment breakdown, and cash to close), loan options (FHA, conventional, VA, USDA, jumbo, ARM; the agent picks which), Colorado down payment assistance (metroDPA, CHFA, CHAC, Chenoa Fund), the road to closed, touring homes (including builder registration), offer strategies, a contract-deadline timeline, inspections, low appraisals, title insurance, the buyer’s team (at least three lenders, inspectors, and home warranty companies from Preferred partners, alphabetical), a wire fraud warning, and next steps.

- Start one from the tile or from **Buyer presentation** on any buyer in the Buyers pipeline.
- Each has an agent-only **appointment checklist** (disclosures before confidential discussion, Exclusive Right-to-Buy, mold, wire fraud, radon, lead-based paint, packet contents, pre-approval, proof of funds, MLS portal). It never prints.
- Assistance program and loan details are general and change every year; the PDF tells buyers to confirm with a participating lender.

### Road to Closed training
The **Training** section has **Road to Closed training**: 19 short lessons along one road, built from the 2026 Road to Closed Training Guide (financing, the buyer side, the listing side, contract clauses and FIRPTA, and CTM). Each lesson opens with a "Know this" card, then multiple-choice questions with an explanation after every answer. Missed questions come back at the end of the lesson. Lessons unlock in order, XP and a daily streak carry over, and finishing the road unlocks the 20-question **Road test** (80% to pass), which certifies the agent. The broker sees every agent's lessons, XP, streak, and certification under **Team progress**. Update the lessons in `search/training.js` when the guide changes; loan limits and assistance programs change every year.

### Scripts and writing
The **Scripts and writing** tile drafts listing descriptions, listing presentation and pricing talk tracks, listing video scripts, open house follow-ups, objection handling, expired, FSBO, neighborhood, and sphere call scripts, buyer consultations, the buyer **under contract email** (from the training template, with inspectors filled in from Preferred partners), and offer cover notes. Listing description drafts carry a reminder from the training to rewrite them in the agent’s own words. It pulls facts from a chosen listing, client, or CMA, and every draft follows Fair Housing rules, treats fees as negotiable, and leaves placeholders instead of inventing details. Starter scripts work before the AI is connected. Agents can save scripts to reuse. Before using call scripts for prospecting, scrub numbers against the Do Not Call registry.

### Connecting email
Without this, Send opens the agent’s email app with the message filled in.

1. Sign up at resend.com, verify your domain, and create an API key.
2. In Vercel, add `RESEND_API_KEY`, `EMAIL_FROM` (an address on the verified domain), `EMAIL_FOOTER` (brokerage name and mailing address), and `CRON_SECRET` (any long random string).
3. Put `https://<your-vercel-app>/api/email` in `EMAIL_ENDPOINT` in `assets/config.js`.

Emails go out from your brokerage address with the agent’s name, and replies go to the agent. Agents who choose "Send anniversaries and birthdays automatically" have them sent each morning by the daily job in `server/vercel.json`.

### Tests
`npm i jsdom`, then `node search/test/multi-agent.test.js` (permissions), `office.test.js` (office tools), `cma.test.js`, `presentation.test.js`, and `buyer-presentation.test.js` (these also need `npm i jspdf@2.5.1`), `writer.test.js`, `training.test.js`, and `demo.test.js` run the app against a simulated database. `node server/test/proxy.test.js` and `node server/test/followups.test.js` check the server functions.

## Using it
- **Leads**: every form on the site lands in Admin, Leads. Move leads between stages (list or board), add notes and tasks, set follow-up dates, export CSV.
- **Landing pages**: Admin, Landing pages, New. Start from a template (open house, home value, buyer consultation, commercial, land, event RSVP). Mark it Live. Use the Links button to make a separate tracked link for Google Ads, Facebook, email, flyers or QR codes. Each lead shows where it came from. Pages are hidden from Google by default.
- **Ad conversion tracking**: set a "send them to this page after submitting" value of `thank-you.html` on the landing page, then count visits to that page as conversions in Google or Meta.
- **Listings, blog, testimonials**: add them under their tabs. They appear on the site as soon as you mark them live.
- **SEO**: Admin, SEO shows title and description length checks, generates `sitemap.xml`, and has a checklist. Edit the title and description of the core pages at the top of each HTML file.

## Good to know
- GitHub Pages is static, so the admin and CRM run in the browser and talk to Supabase. Blog posts and landing pages are loaded from the database when someone visits. Google can read them, but static pages are a little more reliable for search, so keep your most important pages (buy, sell, commercial, development, communities) as the HTML files.
- Forms can be spammed. A hidden field catches basic bots. If you get junk, add Cloudflare Turnstile (free) in front of the forms.
- You are collecting personal information. Have an attorney review the privacy policy, terms and fair housing pages before launch, and check Colorado advertising rules for brokerages (your brokerage name and license must be clear on the site).
- Photos: add `assets/img/brandon.jpg` for the About page. Listing and blog images use links to images you host somewhere.
- Back up your leads by exporting the CSV now and then.
