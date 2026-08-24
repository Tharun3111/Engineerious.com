"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchItem = { slug: string; title: string; dek: string; pillar: string };

/**
 * Keyboard-first search. ⌘K / Ctrl+K or "/" opens it from anywhere on the
 * site (except while typing in another field); arrow keys navigate, Enter
 * opens, Escape closes.
 *
 * This is table stakes for "tool, not magazine" — Linear, Raycast and Vercel
 * all have it — so it isn't the design's signature (see ScopeBlock for that),
 * but a personal teaching site with none of the polish this implies would
 * read as a template regardless of colour or type.
 *
 * Index loads lazily on first open from /api/search, not bundled at build
 * time — keeps the client bundle flat regardless of how many posts exist.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    if (items === null) {
      fetch("/api/search")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: SearchItem[]) => setItems(data))
        .catch(() => setItems([]));
    }
    // Focus after the panel mounts, not on the same tick it's requested.
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open, items]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((v) => !v);
      } else if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape" && open) {
        close();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const filtered = (items ?? []).filter((item) => {
    if (!query.trim()) return true;
    const haystack = `${item.title} ${item.dek} ${item.pillar}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  function go(item: SearchItem) {
    close();
    router.push(`/blog/${item.slug}`);
  }

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (event.key === "Enter" && filtered[active]) {
      event.preventDefault();
      go(filtered[active]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto flex shrink-0 items-center gap-2 rounded-md border border-rule-strong bg-bg px-2.5 py-1.5 text-[12px] text-muted transition-colors duration-150 hover:border-accent"
        aria-label="Search entries"
      >
        {/* Full label + kbd hint from sm up; icon-only below that so the nav row
            wraps on its own terms instead of squeezing this into "S…". */}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 sm:hidden" aria-hidden>
          <circle cx="9" cy="9" r="6" />
          <path d="m17 17-4.3-4.3" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Search entries&hellip;</span>
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          <span className="kbd">&#8984;</span>
          <span className="kbd">K</span>
        </span>
      </button>

      {open && (
        <>
          <div className="cmdk-scrim" onClick={close} aria-hidden />
          <div className="cmdk-panel" role="dialog" aria-modal="true" aria-label="Search">
            <input
              ref={inputRef}
              className="cmdk-input"
              placeholder="Search entries, topics&hellip;"
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
            />
            <ul className="cmdk-list">
              {items === null ? (
                <li className="cmdk-empty">Loading&hellip;</li>
              ) : filtered.length === 0 ? (
                <li className="cmdk-empty">No entry matches &ldquo;{query}&rdquo;.</li>
              ) : (
                filtered.map((item, i) => (
                  <li
                    key={item.slug}
                    className="cmdk-item"
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                  >
                    <span className="t">{item.title}</span>
                    <span className="g">{item.pillar}</span>
                  </li>
                ))
              )}
            </ul>
            <div className="cmdk-foot">
              <span>&uarr;&darr; navigate</span>
              <span>&crarr; open</span>
              <span>esc close</span>
              <span className="ml-auto">
                {items === null ? "" : `${filtered.length} of ${items.length}`}
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
