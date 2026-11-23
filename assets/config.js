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
  SUPABASE_URL: 'https://tpbfxboyzxradpwucjov.supabase.co',                 // e.g. 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: 'sb_publishable_YNZzIbCm6_T_CDqn2l0jkw_02LIt1td',            // the publishable key (sb_publishable_…) or legacy anon key; safe to publish because the SQL policies protect the data

  // Home search and agent tools (search/). Leave the two addresses blank to run on sample listings with no AI.
  IDX_ENDPOINT: '',                 // live listings, e.g. 'https://miller-tools.vercel.app/api/idx'
  AI_ENDPOINT: '',                  // agent AI tools, e.g. 'https://miller-tools.vercel.app/api/ai'
  DEFAULT_AGENT_SLUG: 'brandon',    // clients who arrive without an agent's link are assigned to this agent
  DEMO_MODE: true,                  // testing: anyone who isn't a signed-in agent can open the Agent tab with sample data
                                    // (nothing they change is saved). Set to false before launch.
  AGENT_PAGES_URL: '',              // server-rendered agent pages for search engines, e.g. 'https://miller-tools.vercel.app/a' (blank: pages use /p/)
  EMAIL_ENDPOINT: '',               // follow-up emails, e.g. 'https://miller-tools.vercel.app/api/email' (blank: Send opens the email app)
  NOTIFY_ENDPOINT: '',              // client updates by email and text, e.g. 'https://miller-tools.vercel.app/api/notify'
  SMS_ENABLED: false,               // true once Twilio is set up on the server (see server/.env.example)
  NEWSLETTER_ENDPOINT: '',          // e.g. 'https://miller-tools.vercel.app/api/newsletter'
  NEWS_ENDPOINT: '',                // broker's News desk search, e.g. 'https://miller-tools.vercel.app/api/news'
  HAZARDS_ENDPOINT: '',             // FEMA flood zone lookup for listings, e.g. 'https://miller-tools.vercel.app/api/hazards'
  GUIDE_ENDPOINT: '',               // client transaction guide answers, e.g. 'https://miller-tools.vercel.app/api/guide'

  // Ad tracking (optional)
  GA4_ID: '',                       // e.g. 'G-XXXXXXXXXX'
  META_PIXEL_ID: ''                 // e.g. '123456789012345'
};
