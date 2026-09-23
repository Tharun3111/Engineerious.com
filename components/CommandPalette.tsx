"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { SearchItem, SearchItemKind } from "@/lib/search-index";

const KIND_LABELS = {
  writing: "Writing",
  daily: "Daily",
  signal: "AI signal",
  topic: "Topic",
  project: "Project",
  concept: "Concept",
  framework: "Framework",
  model: "Model",
} satisfies Record<SearchItemKind, string>;

function meaningfulFocusTarget(target: Element | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (target === document.body || target === document.documentElement) return false;
  return target.matches(
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
  );
}

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
  const [loadError, setLoadError] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const listboxId = useId();
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    if (loadError) setItems(null);
    window.setTimeout(() => {
      const target = restoreFocusRef.current;
      if (target?.isConnected) target.focus();
      else triggerRef.current?.focus();
    }, 0);
  }, [loadError]);

  const openPalette = useCallback(() => {
    restoreFocusRef.current = meaningfulFocusTarget(document.activeElement)
      ? document.activeElement
      : triggerRef.current;
    setQuery("");
    setActive(0);
    setLoadError(false);
    setOpen(true);

    if (items === null || loadError) {
      fetch("/api/search")
        .then((res) => {
          if (!res.ok) throw new Error("Search index unavailable");
          return res.json();
        })
        .then((data: SearchItem[]) => setItems(data))
        .catch(() => {
          setItems([]);
          setLoadError(true);
        });
    }
  }, [items, loadError]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus after the panel mounts, not on the same tick it's requested.
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(id);
    };
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (open) close();
        else openPalette();
      } else if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        openPalette();
      } else if (event.key === "Escape" && open) {
        close();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, openPalette]);

  const filtered = (items ?? []).filter((item) => {
    if (!query.trim()) return true;
    const haystack = [item.title, item.description, item.label, ...item.keywords]
      .join(" ")
      .toLocaleLowerCase("en-US");
    return haystack.includes(query.trim().toLowerCase());
  });
  const activeIndex = filtered.length > 0 ? Math.min(active, filtered.length - 1) : 0;

  function go(item: SearchItem) {
    close();
    router.push(item.href);
  }

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(activeIndex + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault();
      go(filtered[activeIndex]);
    }
  }

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const first = closeRef.current;
    const last = inputRef.current;
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const activeOptionId = filtered[activeIndex]
    ? `${listboxId}-option-${activeIndex}`
    : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPalette}
        className="ml-auto flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md border border-rule-strong bg-bg px-3 text-[12px] text-muted transition-colors duration-150 hover:border-accent"
        aria-label="Search Engineerious"
        aria-haspopup="dialog"
        aria-expanded={open}
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
          <div
            className="cmdk-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${listboxId}-title`}
            onKeyDown={trapFocus}
          >
            <div className="cmdk-head">
              <label id={`${listboxId}-title`} htmlFor={`${listboxId}-input`}>
                Search Engineerious
              </label>
              <button ref={closeRef} type="button" onClick={close} className="cmdk-close">
                Close
              </button>
            </div>
            <input
              id={`${listboxId}-input`}
              ref={inputRef}
              className="cmdk-input"
              placeholder="Search entries, topics&hellip;"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
            />
            <ul id={listboxId} className="cmdk-list" role="listbox" aria-label="Search results">
              {items === null ? (
                <li className="cmdk-empty" role="status">Loading search index&hellip;</li>
              ) : loadError ? (
                <li className="cmdk-empty" role="status">
                  Search is unavailable right now. Close this panel and try again.
                </li>
              ) : filtered.length === 0 ? (
                <li className="cmdk-empty" role="status">No entry matches &ldquo;{query}&rdquo;.</li>
              ) : (
                filtered.map((item, i) => (
                  <li
                    key={item.id}
                    id={`${listboxId}-option-${i}`}
                    className="cmdk-item"
                    role="option"
                    aria-selected={i === activeIndex}
                    data-active={i === activeIndex}
                    onMouseEnter={() => setActive(i)}
                  >
                    <button type="button" tabIndex={-1} onClick={() => go(item)}>
                      <span className="t">{item.title}</span>
                      <span className="g">
                        {KIND_LABELS[item.kind]}
                        {item.label ? ` · ${item.label}` : ""}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="cmdk-foot">
              <span>&uarr;&darr; navigate</span>
              <span>&crarr; open</span>
              <span>esc close</span>
              <span className="ml-auto" aria-live="polite">
                {items === null ? "" : `${filtered.length} of ${items.length}`}
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
