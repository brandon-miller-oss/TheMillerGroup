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

- **Transactions:** contract dates entered from the signed contract, a document checklist with links to signed copies, deadline alerts on Agent home, and Submit for review. You approve or request changes from **Broker review**.
- **Company hub:** policies, forms, training, and announcements (as links to your files), with "must read" tracking. You also set the **commission plan** (per-transaction fee, E&O, monthly fee, yearly cap) and **Connections** (eSign, MLS, and training links) here.
- **My income:** each agent’s commission, brokerage fees, referral fees, net, and expenses for the year, with CSV export. You also see fee totals by agent.
- **Referrals:** clients sent out or received, fee percent, expected fee, and status.
- **Follow-up emails:** home anniversaries (from closed transactions linked to a contact), birthdays, and check-ins, with editable templates. Contacts marked "Do not contact" are always skipped.
- **Preferred partners** and **Brand library:** you add them; every agent sees them. Partners show a RESPA reminder and flag affiliated businesses.
- **Recruiting:** your prospect pipeline (broker only).
- **Prospecting:** Matching clients (finds clients whose saved searches, loved homes, or budgets fit a listing, and messages them), Likely to sell, Import contacts (CSV), folders on contacts and transactions, and a Get started checklist for new agents.

### Connecting email
Without this, Send opens the agent’s email app with the message filled in.

1. Sign up at resend.com, verify your domain, and create an API key.
2. In Vercel, add `RESEND_API_KEY`, `EMAIL_FROM` (an address on the verified domain), `EMAIL_FOOTER` (brokerage name and mailing address), and `CRON_SECRET` (any long random string).
3. Put `https://<your-vercel-app>/api/email` in `EMAIL_ENDPOINT` in `assets/config.js`.

Emails go out from your brokerage address with the agent’s name, and replies go to the agent. Agents who choose "Send anniversaries and birthdays automatically" have them sent each morning by the daily job in `server/vercel.json`.

### Tests
`npm i jsdom`, then `node search/test/multi-agent.test.js` (permissions) and `node search/test/office.test.js` (office tools) run the app against a simulated database. `node server/test/proxy.test.js` and `node server/test/followups.test.js` check the server functions.

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
