/* =====================================================
   SITE SETTINGS: edit this file first
   ===================================================== */
window.MG_CONFIG = {
  SITE_URL: 'https://brandon-miller-oss.github.io/TheMillerGroup',  // change to your custom domain (no trailing slash) once you connect one
  BUSINESS_NAME: 'The Miller Group',
  PHONE: '303-990-0702',
  PHONE_TEL: '+13039900702',
  NOTIFY_EMAIL: 'hello@yourdomain.com',
  LICENSE_TEXT: 'Colorado real estate brokerage license: [add license number]',

  // Back end (free Supabase project). Leave blank to run the site without a database.
  SUPABASE_URL: '',                 // e.g. 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: '',            // the public "anon" key (safe to publish when the SQL policies are installed)

  // Home search and agent tools (search/). Leave the two addresses blank to run on sample listings with no AI.
  IDX_ENDPOINT: '',                 // live listings, e.g. 'https://miller-tools.vercel.app/api/idx'
  AI_ENDPOINT: '',                  // agent AI tools, e.g. 'https://miller-tools.vercel.app/api/ai'
  DEFAULT_AGENT_SLUG: 'brandon',
  EMAIL_ENDPOINT: '',               // follow-up emails, e.g. 'https://miller-tools.vercel.app/api/email' (blank: Send opens the email app)    // clients who arrive without an agent's link are assigned to this agent

  // Ad tracking (optional)
  GA4_ID: '',                       // e.g. 'G-XXXXXXXXXX'
  META_PIXEL_ID: ''                 // e.g. '123456789012345'
};
