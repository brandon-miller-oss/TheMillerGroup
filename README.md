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

### Marketing: print studio
**Marketing** opens on the **Print studio** (social posts are on the second tab). Agents make:

- **Flyers** (8.5 × 11): hero photo, three more photos, price, details, description, agent bar, and a QR code to the listing.
- **Tri-fold listing brochures** (11 × 8.5, inside and outside): cover, photos, home facts, description, agent panel, and a showing call to action.
- **Postcards** (6 × 4 or 9 × 6): just listed, just sold, open house, coming soon, price improved, "thinking of selling?", and market updates that pull the broker's monthly market stats. The back keeps the right half clear for postage and the address and includes a not-a-solicitation note.
- **Event mailers** (5 × 7): open houses, client appreciation events, homebuyer seminars, or any event, with when, where, and RSVP.
- **Business cards** (3.5 × 2): front and back, with the agent's headshot (from their presentation profile) or initials and a QR code to their personal link.

Agents pick a listing, then tap its photos in the order they want (the first is the main photo) or add their own. Off-market listings take photo links, and MLS photos appear once the feed is connected. Agents edit the headline and message (or draft them with AI), preview each side, and download a vector PDF, with an optional 1/8 in. bleed for print shops. Every piece shows the brokerage name, as Colorado advertising rules require, and Equal Housing Opportunity. The app warns when a listing belongs to another brokerage, since advertising it needs that broker's permission and their photos usually can't be used.

### Client updates (notifications)
Clients hear from you automatically when showings are set or change, the day before showings, and before key dates on their transaction.

- **Showings:** when a showing day has a client, a date, and homes, the app asks "Send Jordan an update?" with a preview (on the showing day, on Agent home, and in **Client updates**). In automatic mode it sends 15 seconds after your last change. Changing a home or time offers an updated schedule; deleting a day the client knows about offers a cancellation note. Private stop notes (lockbox codes) are never sent, and they're no longer copied to the client's app either.
- **Showing requests:** pick a date and time on the request card and it becomes a showing for that client (adding them to contacts if needed), with the update ready to send.
- **Transactions:** send a milestone update about a contract date with a note, or turn on "Remind the client the day before key dates" (inspection objection, appraisal, loan terms, closing, possession).
- **Channels:** the client's app (updates appear on their Shortlists page with Add to calendar, Confirm, and Need a different time), email with a calendar file, and text. Texts need consent: either the agent records it on the contact (date and source kept), or the client turns texts on in the app, which shows the consent language. Texts only go out 8 AM to 9 PM Denver time, and do-not-contact is always respected.
- **Server:** `server/api/notify.js` sends email and text. It looks up the contact itself, so the browser never chooses the recipient. `server/api/client-reminders.js` runs daily at 8 AM and sends day-before reminders once each. Set `NOTIFY_ENDPOINT` (and `SMS_ENABLED` once Twilio works) in `assets/config.js`. Texting needs a Twilio account with US A2P 10DLC registration; see `server/.env.example`.
- Every update is logged under **Client updates** with what happened on each channel.

### Websites and landing pages (AI builder)
**Websites and landing pages** lets each agent build a branded website and ad landing pages in minutes. Ten templates (My website, Selling, Buying, Listing spotlight, What's my home worth?, Open house RSVP, Free buyer guide, Neighborhood guide, Event, Blank) fill themselves from the agent's profile, approved brand, listings, testimonials, and market stats.

- **Fully editable:** 14 section types (hero, featured listing, listings, about, services, numbers, testimonials, neighborhoods, gallery, video, text, Q&A, call to action, lead form). Reorder, hide, duplicate, add, or delete sections; edit every field; pick listing photos or upload your own; choose fonts, corners, and light or dark. Desktop and phone preview.
- **AI:** "Write the whole page" (or quick asks like "More luxury") rewrites every section from a short description; each section can be rewritten on its own. AI can only change words: photos, listings, prices, and reviews stay as entered. The prompt enforces Fair Housing and "use only real facts."
- **SEO:** focus keyword, search title and meta description with counters, share image, hide-from-search option, a live 0 to 100 SEO score with an 11-point checklist, a search-result preview, keyword ideas from AI, and structured data (agent and brokerage, the home on listing pages, and FAQ).
- **Publishing:** pages live at `/p/?a=<agent link name>&p=<page>` on this site. For search engines, deploy the `server/` folder and set `AGENT_PAGES_URL`; pages are then server-rendered at `/a/<agent>/<page>`, with `/sitemap-agents.xml` listing every live, indexable page. Agents can also download any page as a standalone HTML file.
- **Leads:** form submissions go through `submit_agent_lead` (in `supabase/agent-tools.sql`), which only accepts published pages, limits floods, and saves the lead to the brokerage lead list (with UTM tags) and straight into the agent's contacts under "Website leads." Each form includes the consent line for calls, texts, and email.
- **Compliance on every page:** the agent's approved brand with "Brokered by The Miller Group" in the header and footer, the brokerage and license line, Equal Housing Opportunity, Privacy and Fair Housing links, and "Listing courtesy of" on other brokerages' listings (Colorado Rule 6.10 and IDX display rules). Public pages only show a brand the broker approved.

### AI marketing assistant
- **Listing launch:** pick a listing and get 17 pieces at once: MLS headline and remarks, three social posts, hashtags, LinkedIn, Meta ad (primary text, headline, description), Google search ad (headlines and descriptions), email subject, preview, and body, a text message, and a 30-second reel script. Then one tap builds the landing page, a flyer, or a social graphic.
- **Social calendar:** a 2 or 4 week posting plan with captions and hashtags, downloadable as a spreadsheet.
- **Ads:** Meta and Google copy by goal (seller leads, buyer leads, open house, brand), with setup notes for Meta's Housing special ad category, landing pages, UTM tags, and budget.
- **Email:** monthly market update, just sold nearby, buyer welcome, past client check-in, and holiday notes, each with a matching text.
- **SEO blog:** a local article with title, search title, meta description, keyword ideas, and headings, which becomes a website page in one tap.
- **Fair Housing check:** flags risky words (who a home is "perfect for," school and safety claims, religion, exclusionary terms, outdated disability language, source-of-income exclusions) with better wording, on everything the assistant writes and on anything pasted in.
- Every output has character counts against each platform's limit and a Copy button. Without AI connected, the assistant fills templates from real listing and market facts; with AI it writes custom copy in the chosen voice.

### Agent brands and the starter kit
Agents can market under their own business name, brokered by The Miller Group (the eXp-style model). In **My brand and starter kit** an agent sets a business name, tagline, two colors (presets or custom), and optional logos for light and dark backgrounds, then submits it.

- **Broker approval:** the broker approves or requests changes under **Agent brands**. Approvals live in `company/brandok/items/<agent id>`, which only the broker can write. Any later change to the name, colors, or logos needs a new approval; until then, materials fall back to The Miller Group brand. The broker's own brand is approved when saved.
- **Where it shows:** an approved brand leads every print studio piece, listing and buyer presentation, and CMA report. "Brokered by The Miller Group" always appears right with it (at least about half the size of the business name), plus the brokerage in every footer. The broker can switch the print studio to "Making materials for" any agent.
- **Colorado rules built in:** Rule 6.10 requires advertising to be clearly and conspicuously in the brokerage firm's name, and team names can't include Realty, Real estate, Realtors, Company, Corp., Inc., LLC, LP, LLP, or anything that suggests a separate entity. The name check blocks those words (plus Brokerage, Ltd., and Limited) and flags colors that would be hard to read.
- **Starter marketing kit:** one PDF with a brand sheet (colors, type, and the usage rules), business cards, letterhead, a "Meet your agent" one-pager, a farming postcard, and an open house sign-in sheet. Agents also get a copy-ready email signature and social profile and cover images. "Set up your brand" is a Get started step for new agents.
- PDFs now use the agent who made them (name, phone, profile), not the broker's.

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
`npm i jsdom`, then `node search/test/multi-agent.test.js` (permissions), `office.test.js` (office tools), `cma.test.js`, `presentation.test.js`, and `buyer-presentation.test.js` (these also need `npm i jspdf@2.5.1`), `writer.test.js`, `training.test.js`, `print-studio.test.js`, `agent-brand.test.js`, `sites.test.js`, and `client-notify.test.js` (the first two also need `npm i qrcode-generator@1.4.4`), and `demo.test.js` run the app against a simulated database. `node server/test/proxy.test.js`, `node server/test/followups.test.js`, `node server/test/pages.test.js`, and `node server/test/notify.test.js` check the server functions.

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
