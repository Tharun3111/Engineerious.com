import { z } from "zod";

import { env } from "@/lib/env";

const RESEND_API = "https://api.resend.com";
const RESEND_TIMEOUT_MS = 15_000;
const RESEND_USER_AGENT = "Engineerious/0.1 (+https://engineerious.com)";

const resendIdSchema = z.string().trim().min(1).max(256);
const idResponseSchema = z.object({ id: resendIdSchema }).passthrough();
const contactResponseSchema = z
  .object({
    id: resendIdSchema,
    email: z.string().email(),
    unsubscribed: z.boolean(),
  })
  .passthrough();
const contactSegmentsResponseSchema = z
  .object({
    data: z.array(z.object({ id: resendIdSchema }).passthrough()),
  })
  .passthrough();
const broadcastStatusSchema = z.enum([
  "draft",
  "scheduled",
  "queued",
  "sent",
  "canceled",
]);
const broadcastResponseSchema = z
  .object({ id: resendIdSchema, status: broadcastStatusSchema })
  .passthrough();

export type ResendBroadcastStatus = z.infer<typeof broadcastStatusSchema>;
export type ResendBroadcast = z.infer<typeof broadcastResponseSchema>;

/** A mutating request marked ambiguous must be reconciled, never retried blindly. */
export class ResendRequestError extends Error {
  readonly status: number | null;
  readonly ambiguous: boolean;

  constructor(message: string, input: { status?: number; ambiguous: boolean }) {
    super(message);
    this.name = "ResendRequestError";
    this.status = input.status ?? null;
    this.ambiguous = input.ambiguous;
  }
}

export function resendConfigured(): boolean {
  return [env.resendApiKey, env.resendSegmentId, env.resendFromAddress].every(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

export function newsletterDeliveryConfigured(): boolean {
  return Boolean(resendConfigured() && env.newsletterPostalAddress?.trim());
}

function requireResendConfiguration(): void {
  if (!resendConfigured()) throw new Error("Resend is not configured");
}

function safeProviderMessage(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500) || "no response body";
}

async function resendJson<T>(input: {
  path: string;
  init: RequestInit;
  schema: z.ZodType<T>;
  /** A lost/malformed success response to a mutation is not safe to retry. */
  mutation: boolean;
}): Promise<T> {
  requireResendConfiguration();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

  let response: Response;
  let bodyText: string;
  try {
    response = await fetch(`${RESEND_API}${input.path}`, {
      ...input.init,
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${env.resendApiKey}`,
        "content-type": "application/json",
        "user-agent": RESEND_USER_AGENT,
        ...(input.init.headers ?? {}),
      },
    });
    bodyText = await response.text();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ResendRequestError(`Resend ${input.path} did not return a response: ${reason}`, {
      ambiguous: input.mutation,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ResendRequestError(
      `Resend ${input.path} returned ${response.status}: ${safeProviderMessage(bodyText)}`,
      {
        status: response.status,
        ambiguous:
          input.mutation &&
          (response.status === 408 || response.status === 429 || response.status >= 500),
      },
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(bodyText);
  } catch {
    throw new ResendRequestError(`Resend ${input.path} returned malformed JSON.`, {
      status: response.status,
      ambiguous: input.mutation,
    });
  }

  const parsed = input.schema.safeParse(decoded);
  if (!parsed.success) {
    throw new ResendRequestError(`Resend ${input.path} returned an unexpected response shape.`, {
      status: response.status,
      ambiguous: input.mutation,
    });
  }
  return parsed.data;
}

async function getContactByEmail(
  email: string,
): Promise<{ id: string; unsubscribed: boolean } | null> {
  try {
    const contact = await resendJson({
      path: `/contacts/${encodeURIComponent(email)}`,
      init: { method: "GET" },
      schema: contactResponseSchema,
      mutation: false,
    });
    return { id: contact.id, unsubscribed: contact.unsubscribed };
  } catch (error) {
    if (error instanceof ResendRequestError && error.status === 404) return null;
    throw error;
  }
}

async function createContact(email: string): Promise<{ id: string }> {
  const contact = await resendJson({
    path: "/contacts",
    init: {
      method: "POST",
      body: JSON.stringify({
        email,
        segments: [{ id: env.resendSegmentId }],
      }),
    },
    schema: idResponseSchema,
    mutation: true,
  });
  return { id: contact.id };
}

async function listContactSegmentIds(id: string): Promise<string[]> {
  const safeId = resendIdSchema.parse(id);
  const result = await resendJson({
    path: `/contacts/${encodeURIComponent(safeId)}/segments`,
    init: { method: "GET" },
    schema: contactSegmentsResponseSchema,
    mutation: false,
  });
  return result.data.map((segment) => segment.id);
}

async function ensureContactSegment(id: string): Promise<void> {
  const safeId = resendIdSchema.parse(id);
  const segmentId = resendIdSchema.parse(env.resendSegmentId);
  if ((await listContactSegmentIds(safeId)).includes(segmentId)) return;

  try {
    await resendJson({
      path: `/contacts/${encodeURIComponent(safeId)}/segments/${encodeURIComponent(segmentId)}`,
      init: { method: "POST", body: JSON.stringify({}) },
      schema: idResponseSchema,
      mutation: true,
    });
  } catch (error) {
    // A concurrent repair may have added the membership after our list request.
    if (
      error instanceof ResendRequestError &&
      error.status === 409 &&
      (await listContactSegmentIds(safeId)).includes(segmentId)
    ) {
      return;
    }
    throw error;
  }
}

/**
 * Create a verified-missing contact or ensure an existing active contact's segment.
 * The public form cannot prove inbox ownership, so a provider-side opt-out is
 * returned as already synchronized without changing consent or segment membership.
 */
export async function upsertContact(email: string): Promise<string> {
  let contact = await getContactByEmail(email);
  if (!contact) {
    try {
      const created = await createContact(email);
      return created.id;
    } catch (error) {
      // Resolve a concurrent creator through the documented update path.
      if (!(error instanceof ResendRequestError) || error.status !== 409) throw error;
      contact = await getContactByEmail(email);
      if (!contact) throw error;
    }
  }

  if (contact.unsubscribed) return contact.id;
  await ensureContactSegment(contact.id);
  return contact.id;
}

export async function createBroadcastDraft(input: {
  subject: string;
  html: string;
}): Promise<{ id: string }> {
  const response = await resendJson({
    path: "/broadcasts",
    init: {
      method: "POST",
      body: JSON.stringify({
        segment_id: env.resendSegmentId,
        from: env.resendFromAddress,
        subject: input.subject,
        html: input.html,
        send: false,
      }),
    },
    schema: idResponseSchema,
    mutation: true,
  });
  return { id: response.id };
}

export async function getBroadcast(id: string): Promise<ResendBroadcast> {
  const safeId = resendIdSchema.parse(id);
  return resendJson({
    path: `/broadcasts/${encodeURIComponent(safeId)}`,
    init: { method: "GET" },
    schema: broadcastResponseSchema,
    mutation: false,
  });
}

export async function sendBroadcast(id: string): Promise<{ id: string }> {
  const safeId = resendIdSchema.parse(id);
  const response = await resendJson({
    path: `/broadcasts/${encodeURIComponent(safeId)}/send`,
    init: { method: "POST", body: JSON.stringify({}) },
    schema: idResponseSchema,
    mutation: true,
  });
  return { id: response.id };
}
