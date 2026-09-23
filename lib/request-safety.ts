import { NextResponse } from "next/server";

import { ADMIN_REALM } from "@/lib/auth";

export const JSON_BODY_LIMITS = {
  /** Daily review payloads are the largest browser-authored admin mutation. */
  admin: 256 * 1024,
  publicSubmit: 16 * 1024,
  publicSubscribe: 4 * 1024,
} as const;

type SafeJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

function jsonError(error: string, status: number): SafeJsonResult {
  return {
    ok: false,
    response: NextResponse.json(
      { error },
      {
        status,
        headers: { "cache-control": "private, no-store" },
      },
    ),
  };
}

export function adminUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "cache-control": "private, no-store",
        "www-authenticate": ADMIN_REALM,
      },
    },
  );
}

function mutationMetadataError(request: Request): SafeJsonResult | null {
  const mediaType = (request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return jsonError("Content-Type must be application/json.", 415);
  }

  const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase();
  if (contentEncoding && contentEncoding !== "identity") {
    return jsonError("Encoded request bodies are not supported.", 415);
  }

  if (request.headers.get("sec-fetch-site")?.trim().toLowerCase() === "cross-site") {
    return jsonError("Cross-site mutations are forbidden.", 403);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return jsonError("Foreign-origin mutations are forbidden.", 403);
      }
    } catch {
      return jsonError("The request Origin is invalid.", 403);
    }
  }

  return null;
}

async function readBodyBytes(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Validate browser mutation metadata, then read and parse a JSON body without
 * ever buffering more than `maxBytes`. Requests without browser Origin metadata
 * remain available to authenticated Bearer clients and command-line operators.
 */
export async function readBoundedJsonMutation(
  request: Request,
  maxBytes: number,
): Promise<SafeJsonResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("A positive, integer JSON body limit is required.");
  }

  const metadataError = mutationMetadataError(request);
  if (metadataError) return metadataError;

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    if (!/^\d+$/.test(contentLength)) {
      return jsonError("Content-Length is invalid.", 400);
    }
    if (Number(contentLength) > maxBytes) {
      return jsonError(`JSON body must be ${maxBytes} bytes or fewer.`, 413);
    }
  }

  let bytes: Uint8Array | null;
  try {
    bytes = await readBodyBytes(request, maxBytes);
  } catch {
    return jsonError("The request body could not be read.", 400);
  }
  if (!bytes) return jsonError(`JSON body must be ${maxBytes} bytes or fewer.`, 413);

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return jsonError("JSON body must use valid UTF-8.", 400);
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return jsonError("Request body must contain valid JSON.", 400);
  }
}
