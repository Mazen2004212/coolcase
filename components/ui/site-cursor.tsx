"use client";

import { useEffect, useRef } from "react";

const TEXT_INPUT_SELECTOR =
  "input:not([type]), input[type='text'], input[type='email'], input[type='password'], input[type='tel'], input[type='search'], input[type='number'], input[type='url'], textarea, [contenteditable='true'], [role='textbox']";

export function SiteCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const cursor = cursorRef.current;
    if (!cursor) return;

    function hide() {
      if (cursor) cursor.dataset.visible = "false";
    }

    function handleMove(event: globalThis.PointerEvent) {
      if (!cursor || !query.matches || event.pointerType === "touch") return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(TEXT_INPUT_SELECTOR)) {
        hide();
        return;
      }
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      cursor.dataset.visible = "true";
    }

    function updateAvailability() {
      document.body.classList.toggle("cc-cursor-ready", query.matches);
      if (!query.matches) hide();
    }

    updateAvailability();
    query.addEventListener("change", updateAvailability);
    window.addEventListener("pointermove", handleMove, { passive: true });
    document.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.body.classList.remove("cc-cursor-ready");
      query.removeEventListener("change", updateAvailability);
      window.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  return (
    <div ref={cursorRef} className="cc-site-cursor" data-visible="false" aria-hidden="true">
      <svg viewBox="0 0 24 30" width="22" height="28" focusable="false" aria-hidden="true">
        <path
          d="M2 1.5v22l5.7-5.2 4.1 9 4.2-1.9-4.3-8.7H20L2 1.5Z"
          fill="white"
          stroke="white"
          strokeLinejoin="round"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
}
