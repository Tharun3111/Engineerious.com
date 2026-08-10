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
  beehiivApiKey: process.env.BEEHIIV_API_KEY,
  beehiivPublicationId: process.env.BEEHIIV_PUBLICATION_ID,
  /** Public so the signup form can render as a plain embed with no API key. */
  beehiivEmbedUrl: process.env.NEXT_PUBLIC_BEEHIIV_EMBED_URL,

  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  llmModel: process.env.LLM_MODEL ?? "claude-sonnet-5",

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

  /**
   * When true, newly ingested items land as `pending` and only appear in the feeds
   * after a human approves them in /admin. Recommended once traffic is real; off by
   * default so a fresh install shows a populated feed on first cron run.
   */
  requireIngestApproval: process.env.INGEST_REQUIRE_APPROVAL === "true",
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
