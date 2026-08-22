import { describe, expect, it } from "vitest";

import { isPublishableModel } from "@/lib/adapters/huggingface";

describe("isPublishableModel", () => {
  it("blocks the exact repos that reached the live /models page", () => {
    // Measured on engineerious.com 2026-08-21, under the heading "Model updates
    // compared for real-world use".
    for (const id of [
      "ModdiAdam/Wild_Krea-2-turbo_NSFW",
      "RonnyMaurer255/MyAwesomeModel-TestRepo",
      "XiAT/MyAwesomeModel-TestRepo",
      "fpadovani/jpn-100mb-after-eng-baseline-ckpt500_seed455",
      "fpadovani/eng-100mb-after-eng-baseline-ckpt500_seed455",
      "orcarouter/Qwen3.8-27B-Uncensored-MLX",
      "DavidAU/Qwen3.6-27B-Fable-Fusion-711-Uncensored-Heretic-NM-DAU-NEO-MAX-MTP-GGUF",
      "orcarouter/Qwen3.8-27B-Uncensored-GGUF",
    ]) {
      expect(isPublishableModel({ id }), id).toBe(false);
    }
  });

  it("blocks safety-filter-stripped builds by any of their usual names", () => {
    for (const id of [
      "someone/model-abliterated",
      "someone/model-unaligned",
      "someone/nsfw-diffusion",
      "someone/hentai-mix",
    ]) {
      expect(isPublishableModel({ id }), id).toBe(false);
    }
  });

  it("blocks on tags even when the id looks clean", () => {
    expect(isPublishableModel({ id: "org/perfectly-normal-name", tags: ["not-for-all-audiences"] })).toBe(false);
    expect(isPublishableModel({ id: "org/perfectly-normal-name", tags: ["NSFW"] })).toBe(false);
  });

  it("lets real releases through", () => {
    for (const id of [
      "meta-llama/Llama-4-70B-Instruct",
      "Qwen/Qwen3-32B",
      "mistralai/Mistral-Large-Instruct-2411",
      "openai/whisper-large-v3",
      "google/gemma-3-27b-it",
      "deepseek-ai/DeepSeek-V4",
    ]) {
      expect(isPublishableModel({ id }), id).toBe(true);
    }
  });

  it("does not block a legitimate model for merely containing a blocked word inside another word", () => {
    // "seed" alone is a real model family (SeedLM, Seed-OSS); only seed<digits> is a
    // training artefact. Likewise "Testudo" must not trip the test-repo pattern.
    expect(isPublishableModel({ id: "ByteDance/Seed-OSS-36B" })).toBe(true);
    expect(isPublishableModel({ id: "org/Testudo-7B" })).toBe(true);
  });

  it("treats a missing tags array as no tags rather than throwing", () => {
    expect(isPublishableModel({ id: "org/model" })).toBe(true);
    expect(isPublishableModel({ id: "org/model", tags: undefined })).toBe(true);
    expect(isPublishableModel({ id: "org/model", tags: [] })).toBe(true);
  });
});
