import { env } from "@/lib/env";
import { GITHUB_TOPICS, GITHUB_TRACKED_REPOS, SOURCE_WEIGHTS } from "@/lib/sources";
import type { IngestAdapter, RawItem } from "@/lib/adapters/types";

/**
 * GitHub REST. Two adapters:
 *   1. search  — new AI repos gaining stars   (GET /search/repositories)
 *   2. releases— new versions of repos we track (GET /repos/{owner}/{repo}/releases)
 *
 * Rate limits are the binding constraint, not capability:
 *   - Search: 30 req/min authenticated, 10 req/min unauthenticated.
 *   - Search returns at most 1000 results per query, so deep paging is pointless.
 *   - Core REST: 5000 req/hour authenticated. The release sweep is 8 requests.
 * The search index also lags newly created repos by minutes; that is expected.
 *
 * One query PER TOPIC, deliberately. The repository search grammar has no boolean
 * OR — `(topic:llm OR topic:agents) …` is not a union, it parses to something that
 * matches nothing and returns total_count: 0 with a 200. Verified 2026-08-09.
 * Multiple `topic:` terms in one query AND together, which is equally wrong. So:
 * `GITHUB_TOPICS.length` requests per run (7 today), well inside the limit.
 */

const API = "https://api.github.com";
const MIN_STARS = 25;
const PER_TOPIC = 30;
const CREATED_WITHIN_DAYS = 180;

type Repo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  created_at: string;
  pushed_at: string;
  owner: { login: string };
  topics?: string[];
};

type Release = {
  html_url: string;
  name: string | null;
  tag_name: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  author: { login: string } | null;
};

function headers(): HeadersInit {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "Engineerious/1.0 (+https://engineerious.com)",
  };
  if (env.githubToken) h.authorization = `Bearer ${env.githubToken}`;
  return h;
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    throw new Error(
      `GitHub ${path}: ${res.status} ${res.statusText}` +
        (remaining === "0" ? " (rate limit exhausted)" : ""),
    );
  }
  return (await res.json()) as T;
}

function truncate(text: string | null, max = 280): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function createdSince(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export const githubSearchAdapter: IngestAdapter = {
  slug: "github-search",
  name: "GitHub",
  type: "oss",
  enabled: () => true, // works unauthenticated at 10 req/min; a PAT is strongly advised
  async fetch(): Promise<RawItem[]> {
    const since = createdSince(CREATED_WITHIN_DAYS);
    const items: RawItem[] = [];

    for (const topic of GITHUB_TOPICS) {
      const q = `topic:${topic} created:>=${since} stars:>=${MIN_STARS}`;
      const path =
        `/search/repositories?q=${encodeURIComponent(q)}` +
        `&sort=stars&order=desc&per_page=${PER_TOPIC}`;

      const body = await gh<{ items?: Repo[] }>(path);
      for (const repo of body.items ?? []) {
        items.push({
          type: "oss",
          title: repo.full_name,
          url: repo.html_url,
          summary: truncate(repo.description),
          source: "GitHub",
          sourceSlug: "github-search",
          sourceWeight: SOURCE_WEIGHTS.githubSearch,
          author: repo.owner.login,
          // Stars are the vote signal here, damped so a 20k-star repo does not sit on
          // the front page for a week purely on absolute count.
          points: Math.round(Math.log10(Math.max(repo.stargazers_count, 1)) * 10),
          publishedAt: new Date(repo.created_at),
          raw: {
            stars: repo.stargazers_count,
            language: repo.language,
            topics: repo.topics,
            pushedAt: repo.pushed_at,
          },
        });
      }
    }

    return items;
  },
};

export const githubReleasesAdapter: IngestAdapter = {
  slug: "github-releases",
  name: "GitHub Releases",
  type: "oss",
  enabled: () => true,
  async fetch(): Promise<RawItem[]> {
    const items: RawItem[] = [];

    for (const repo of GITHUB_TRACKED_REPOS) {
      try {
        const releases = await gh<Release[]>(`/repos/${repo}/releases?per_page=3`);
        for (const release of releases) {
          if (release.draft) continue;
          items.push({
            type: "oss",
            title: `${repo} ${release.tag_name}`,
            url: release.html_url,
            summary: truncate(release.body),
            source: "GitHub Releases",
            sourceSlug: "github-releases",
            sourceWeight: SOURCE_WEIGHTS.githubRelease,
            author: release.author?.login ?? repo.split("/")[0],
            points: 0,
            publishedAt: release.published_at ? new Date(release.published_at) : null,
            raw: { repo, tag: release.tag_name, prerelease: release.prerelease },
          });
        }
      } catch (error) {
        // One dead repo must not sink the whole sweep.
        console.warn(`[github-releases] ${repo} failed:`, error);
      }
    }

    return items;
  },
};
