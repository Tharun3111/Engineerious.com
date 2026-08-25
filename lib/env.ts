/**
 * Env access in one place. Nothing here throws at import time — the app must be
 * buildable (and the marketing pages renderable) without every integration
 * configured. Callers use `requireEnv` at the point of use instead.
 */

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  cronSecret: process.env.CRON_SECRET,
  adminPassword: process.env.ADMIN_PASSWORD,

  githubToken: process.env.GITHUB_TOKEN,
  hfToken: process.env.HF_TOKEN,
  productHuntToken: process.env.PRODUCTHUNT_TOKEN,
  newsApiKey: process.env.NEWS_API_KEY,
  /** "newsdata" | "currents" | "apitube" — see lib/adapters/news-api.ts */
  newsApiProvider: process.env.NEWS_API_PROVIDER,

  bufferToken: process.env.BUFFER_TOKEN,
  /**
   * Public so the signup form can render as a plain embed with no API key. beehiiv
   * is kept ONLY as this optional passive embed — see lib/resend.ts for the actual
   * subscriber capture + send pipeline (beehiiv's programmatic Send API is gated
   * behind a ~$96/mo plan regardless of subscriber count, which is why it's not
   * used for sending).
   */
  beehiivEmbedUrl: process.env.NEXT_PUBLIC_BEEHIIV_EMBED_URL,

  /** Newsletter delivery. See lib/resend.ts. */
  resendApiKey: process.env.RESEND_API_KEY,
  resendSegmentId: process.env.RESEND_SEGMENT_ID,
  resendFromAddress: process.env.RESEND_FROM_ADDRESS,
  /** Required in every delivered email footer; broadcasts fail closed without it. */
  newsletterPostalAddress: process.env.NEWSLETTER_POSTAL_ADDRESS,

  /** Daily-digest pipeline. See lib/adapters/tavily.ts, lib/stocks.ts, lib/research.ts. */
  tavilyApiKey: process.env.TAVILY_API_KEY,
  finnhubApiKey: process.env.FINNHUB_API_KEY,
  twelvedataApiKey: process.env.TWELVEDATA_API_KEY,

  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  /** RESEARCH stage model — large-input synthesis, doesn't need the top tier. */
  llmModel: process.env.LLM_MODEL ?? "claude-sonnet-5",
  /**
   * WRITE + REVIEW stage model — the published deliverable and its safety check.
   * Sonnet 5, not Opus: "cheapest as best" was the original brief, and two Opus
   * calls a day was real, avoidable cost for a solo-operator site with no revenue.
   * Override via LLM_MODEL_PREMIUM if quality ever demands the top tier back.
   */
  llmModelPremium: process.env.LLM_MODEL_PREMIUM ?? "claude-sonnet-5",

  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://engineerious.com",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL,

  /**
   * Social links. Each is undefined until supplied — the icon simply does not
   * render (see components/SocialLinks.tsx) rather than pointing at a dead or
   * placeholder profile.
   */
  twitterUrl: process.env.NEXT_PUBLIC_TWITTER_URL,
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL,
  linkedinUrl: process.env.NEXT_PUBLIC_LINKEDIN_URL,
  githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL,

  /**
   * Newly ingested intelligence is pending by default. An explicit `false` is
   * reserved for local fixtures and private development environments; public
   * deployments must never become auto-publishing feeds because an env var was
   * omitted.
   */
  requireIngestApproval: process.env.INGEST_REQUIRE_APPROVAL !== "false",

  /**
   * Launch gate. Off = /open-source, /submit and /pillars 404 with noindex.
   * /resources remains hard-closed while it contains placeholders. Middleware,
   * robots, sitemap and data queries share this contract; keep all four aligned.
   */
  publicResearchEnabled: process.env.PUBLIC_RESEARCH_ENABLED === "true",

  /**
   * Search engine site-ownership verification (Metadata API `verification` field
   * in app/layout.tsx). Each is the raw token from the respective console, not a
   * full meta tag — Next renders the tag. Undefined = no tag rendered, not an
   * empty/broken one.
   */
  googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION,
  bingSiteVerification: process.env.BING_SITE_VERIFICATION,

  /**
   * IndexNow (Bing/Yandex instant-indexing protocol). The key must also exist as
   * a static file at /<key>.txt containing just the key — see public/ and
   * lib/indexnow.ts. Unset = submitUrls() no-ops rather than failing a publish.
   */
  indexNowKey: process.env.INDEXNOW_KEY,
} as const;

export function requireEnv(name: keyof typeof env): string {
  const value = env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Missing required environment variable for ${String(name)}. See .env.example.`,
    );
  }
  return value;
}

export const isDbConfigured = () => Boolean(env.databaseUrl);
