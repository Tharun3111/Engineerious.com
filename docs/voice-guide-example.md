<!--
  Calibration reference only — NOT a published post. See docs/voice-guide.md.
  Source of the test: first WRITE→REVIEW pass, real source material (a real
  llama.cpp/macOS-VM GPU-passthrough writeup), Tharun-confirmed as close to his real
  voice, then reformatted per his direct feedback (bold highlight convention).
-->

# A macOS VM Reports GPU Family 5. The Hardware Supports 1009.

Run llama.cpp inside a macOS VM on Apple's Virtualization.framework and it takes the slow Metal
path, even on hardware that supports something faster. Ask the guest what GPU family it belongs
to and it reports roughly 5. **The real silicon underneath supports up to 1009.** llama.cpp asks
Metal what it can do, gets the conservative number back, and falls back to kernels that ignore
the hardware it's actually sitting on.

The fix is a shim: a process-scoped compatibility layer that intercepts Metal capability queries
for one guest process and changes the answers. No kernel modification, no host modification, no
effect on any other guest process — just what one process is told when it asks Metal what's
available.

Four things change for that process:

- Reported Apple GPU family: up to 1009, instead of ~5.
- Max threadgroup memory: 64 KB, instead of 32 KB.
- SIMD-group matrix operations: enabled.
- bfloat16 support: enabled.

That's the whole intervention.

The measured difference, on an M1 Ultra with a 48-core GPU, running a Tahoe VM (macOS 26.5.2
guest, macOS 26.6.1 host), against llama.cpp b10167 and b10359:

TinyLlama 1.1B — prompt processing: 432 to 4,787 tok/s, 11.08x. Token generation: 13 to 207 tok/s,
**16.36x**.

Gemma 4 12B — prompt processing: 72 to 516 tok/s, 7.20x. Token generation: 3 to 50 tok/s, 14.54x.

Muse Glimmer 30B — prompt processing 7.55x faster, token generation 8.87x faster. (Same test set;
the source doesn't specify which runtime handled this one, so I won't guess.)

The limits, stated exactly:

The shim uses private Metal implementation details Apple doesn't document — and **those can
change in any macOS release.** It's per-process by design, not systemwide, and hardened
executables may reject the injection outright.

And every number above comes from one machine, one GPU core count, one guest build, three models.
M1 Ultra, 48-core GPU, macOS 26.5.2 guest, macOS 26.6.1 host, llama.cpp b10167 and b10359.
Different silicon or a different macOS version, and these numbers aren't promised to hold — they're
reported for this configuration, not guaranteed for the next one. Everything else about running
macOS in a VM that was constrained before this shim is still constrained after it.
