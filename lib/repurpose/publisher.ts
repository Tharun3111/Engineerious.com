import { env } from "@/lib/env";
import type { Platform } from "@/db/schema";

/**
 * Publishing goes through a unified posting API rather than five native APIs. The
 * native route means Meta app review, a LinkedIn partner application, a YouTube
 * project, and — since February 2026 — pay-per-request X API billing. One vendor
 * absorbs all of that, which is the right trade for a solo operator.
 *
 * Buffer is the default adapter. Ayrshare (more platforms, single REST endpoint) and
 * Postiz (open source, self-hostable) implement the same interface.
 *
 * There is no auto-publish path anywhere in this file. `schedule()` is only reachable
 * from an approved row in /admin.
 */

export type ScheduleRequest = {
  platform: Platform;
  text: string;
  /** Omit to queue at the next slot in the vendor's posting schedule. */
  scheduledFor?: Date | null;
};

export type ScheduleResult = {
  ok: boolean;
  /** Vendor-side id, stored so a later status poll can find the post. */
  id?: string;
  url?: string;
  error?: string;
};

export interface Publisher {
  name: string;
  configured(): boolean;
  schedule(request: ScheduleRequest): Promise<ScheduleResult>;
}

/**
 * Buffer publish API. Requires a paid plan and one connected channel per platform;
 * BUFFER_CHANNEL_<PLATFORM> maps our platform enum onto Buffer's channel ids.
 */
export const bufferPublisher: Publisher = {
  name: "buffer",
  configured: () => Boolean(env.bufferToken),

  async schedule({ platform, text, scheduledFor }): Promise<ScheduleResult> {
    const token = env.bufferToken;
    if (!token) return { ok: false, error: "BUFFER_TOKEN is not set" };

    const channelId = process.env[`BUFFER_CHANNEL_${platform.toUpperCase()}`];
    if (!channelId) {
      return {
        ok: false,
        error: `No channel configured for ${platform}. Set BUFFER_CHANNEL_${platform.toUpperCase()}.`,
      };
    }

    const body: Record<string, unknown> = {
      channelIds: [channelId],
      text,
    };
    if (scheduledFor) body.scheduledAt = scheduledFor.toISOString();

    const res = await fetch("https://api.bufferapp.com/2/updates/create.json", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { ok: false, error: `Buffer ${res.status}: ${await res.text()}` };
    }

    const json = (await res.json()) as {
      updates?: Array<{ id?: string; service_link?: string }>;
    };
    const update = json.updates?.[0];
    return { ok: true, id: update?.id, url: update?.service_link };
  },
};

/**
 * Ayrshare alternate — one endpoint, 13+ platforms. Swap by changing
 * `getPublisher()` below. Left unwired (no AYRSHARE_API_KEY in .env.example) until
 * you pick a vendor.
 */
export const ayrsharePublisher: Publisher = {
  name: "ayrshare",
  configured: () => Boolean(process.env.AYRSHARE_API_KEY),

  async schedule({ platform, text, scheduledFor }): Promise<ScheduleResult> {
    const key = process.env.AYRSHARE_API_KEY;
    if (!key) return { ok: false, error: "AYRSHARE_API_KEY is not set" };

    const res = await fetch("https://app.ayrshare.com/api/post", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        post: text,
        platforms: [platform === "x" ? "twitter" : platform],
        ...(scheduledFor ? { scheduleDate: scheduledFor.toISOString() } : {}),
      }),
    });

    if (!res.ok) return { ok: false, error: `Ayrshare ${res.status}: ${await res.text()}` };

    const json = (await res.json()) as { id?: string; postIds?: Array<{ postUrl?: string }> };
    return { ok: true, id: json.id, url: json.postIds?.[0]?.postUrl };
  },
};

/** Fail closed: an unconfigured publisher must never be mistaken for a real post. */
export const dryRunPublisher: Publisher = {
  name: "not-configured",
  configured: () => false,
  async schedule({ platform }) {
    return {
      ok: false,
      error: `No publisher configured for ${platform}. Use the approved copy manually.`,
    };
  },
};

export function getPublisher(): Publisher {
  if (bufferPublisher.configured()) return bufferPublisher;
  if (ayrsharePublisher.configured()) return ayrsharePublisher;
  return dryRunPublisher;
}
