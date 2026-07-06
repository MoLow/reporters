/**
 * One shared tooltip element, appended to `document.body` and positioned with
 * `position:fixed` + `getBoundingClientRect()`, driven by `data-tip` and event
 * delegation (designer reference engine). A body-level fixed node sits outside
 * every `overflow` container and stacking context, so nothing clips it or
 * paints over it — the failure modes of the previous per-element CSS tooltip.
 *
 * `data-tip` always shows. `data-tip-clipped` shows only while the target's
 * text is actually truncated (ellipsis or line-clamp), checked at hover time
 * so window resizes need no bookkeeping.
 */
export function initTooltips(): void {
  if (document.getElementById('rt-tooltip')) return;
  const tip = document.createElement('div');
  tip.id = 'rt-tooltip';
  tip.className = 'rt-tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  const textFor = (el: Element): string | null => {
    const clipped = el.getAttribute('data-tip-clipped');
    if (clipped && (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)) return clipped;
    return el.getAttribute('data-tip');
  };

  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let current: Element | null = null;

  const place = (el: Element): void => {
    const text = textFor(el);
    if (!text) return;
    tip.textContent = text;
    tip.style.display = 'block';
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 8;
    let top = r.top - t.height - gap;
    if (top < gap) top = r.bottom + gap; // flip below near the top edge
    const left = Math.max(gap, Math.min(r.left + r.width / 2 - t.width / 2, window.innerWidth - t.width - gap));
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    void tip.offsetWidth; // reflow so the opacity fade runs
    tip.style.opacity = '1';
  };
  const hide = (): void => {
    clearTimeout(openTimer);
    current = null;
    tip.style.opacity = '0';
    tip.style.display = 'none';
  };

  const targetOf = (e: Event): Element | null => (e.target as Element | null)?.closest?.('[data-tip], [data-tip-clipped]') ?? null;
  const over = (e: Event): void => {
    const el = targetOf(e);
    if (!el || el === current || !textFor(el)) return;
    current = el;
    clearTimeout(openTimer);
    openTimer = setTimeout(() => place(el), 140);
  };
  const out = (e: Event): void => {
    const el = targetOf(e);
    // Moving between children of the target isn't a leave — don't flicker.
    const to = (e as PointerEvent).relatedTarget as Node | null;
    if (el && el === current && !(to && el.contains(to))) hide();
  };

  document.addEventListener('pointerover', over);
  document.addEventListener('pointerout', out);
  document.addEventListener('focusin', over);
  document.addEventListener('focusout', out);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, true);
}
