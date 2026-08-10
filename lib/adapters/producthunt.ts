import { env } from "@/lib/env";
import { SOURCE_WEIGHTS } from "@/lib/sources";
import type { IngestAdapter, RawItem } from "@/lib/adapters/types";

/**
 * Product Hunt launches via GraphQL API v2.
 *
 * ⚠️ LICENSING: Product Hunt's API terms state the API is for non-commercial use.
 * Engineerious is a commercial-intent property (newsletter, personal brand funnel).
 * Confirm your use is acceptable with Product Hunt, or leave PRODUCTHUNT_TOKEN unset
 * and drop this source. It ships disabled-by-default for exactly that reason.
 *
 * Token: create a Developer Token (non-expiring) at
 * https://www.producthunt.com/v2/oauth/applications
 */

const ENDPOINT = "https://api.producthunt.com/v2/api/graphql";

const QUERY = /* GraphQL */ `
  query LatestAiPosts($after: String) {
    posts(order: RANKING, topic: "artificial-intelligence", first: 30, after: $after) {
      edges {
        node {
          id
          name
          tagline
          url
          website
          votesCount
          createdAt
          user {
            username
          }
        }
      }
    }
  }
`;

type PhNode = {
  id: string;
  name: string;
  tagline: string | null;
  url: string;
  website: string | null;
  votesCount: number;
  createdAt: string;
  user: { username: string } | null;
};

export const productHuntAdapter: IngestAdapter = {
  slug: "producthunt",
  name: "Product Hunt",
  type: "oss",
  enabled: () => Boolean(env.productHuntToken),
  async fetch(): Promise<RawItem[]> {
    const token = env.productHuntToken;
    if (!token) return [];

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "Engineerious/1.0 (+https://engineerious.com)",
      },
      body: JSON.stringify({ query: QUERY }),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Product Hunt: ${res.status} ${res.statusText}`);

    const body = (await res.json()) as {
      data?: { posts?: { edges?: Array<{ node: PhNode }> } };
      errors?: Array<{ message: string }>;
    };
    if (body.errors?.length) throw new Error(`Product Hunt: ${body.errors[0].message}`);

    return (body.data?.posts?.edges ?? []).map(({ node }) => ({
      type: "oss" as const,
      title: node.name,
      // Prefer the maker's own site; the PH page is the fallback.
      url: node.website ?? node.url,
      summary: node.tagline,
      source: "Product Hunt",
      sourceSlug: "producthunt",
      sourceWeight: SOURCE_WEIGHTS.productHunt,
      author: node.user?.username ?? null,
      points: node.votesCount,
      publishedAt: new Date(node.createdAt),
      raw: { id: node.id, productHuntUrl: node.url },
    }));
  },
};
