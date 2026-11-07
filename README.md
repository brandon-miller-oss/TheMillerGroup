# The Miller Group website

A static website for GitHub Pages, with a Supabase back end for leads (CRM), landing pages, listings, blog posts and testimonials.

## What's in the folder
- `index.html` plus 17 pages: buy, sell, home value, commercial, development, communities, listings, about, testimonials, blog, contact, and four legal pages
- `lp/` landing page template (one file serves every landing page)
- `admin/` private admin app: login, CRM, landing page builder, listings, blog, testimonials, SEO tools
- `assets/config.js` the one file with your settings
- `assets/layout.js` the shared menu and footer (edit once, every page updates)
- `supabase/schema.sql` the database setup
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
