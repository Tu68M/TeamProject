const PLACEHOLDER_REGEX = /\{\{([\p{L}\p{N}_]+)\}\}/gu;

export interface PlaceholderRenderOptions {
  getValue?: (key: string) => string;
  isMapped?: (key: string) => boolean;
  onPlaceholderClick?: (key: string) => void;
}

function applyMarkContent(mark: HTMLElement, key: string, options: PlaceholderRenderOptions) {
  mark.dataset.placeholderKey = key;
  const clickable = options.onPlaceholderClick ? "cursor-pointer" : "";

  if (options.getValue) {
    const value = options.getValue(key) || "";
    const filled = Boolean(value);
    mark.textContent = filled ? value : `{{${key}}}`;
    mark.className = `rounded-sm px-0.5 ${clickable} ${filled ? "bg-ok/20 text-okt" : "bg-wn/25 text-wnt"}`;
    return;
  }

  mark.textContent = `{{${key}}}`;
  const mapped = options.isMapped?.(key) ?? false;
  mark.className = `rounded-sm px-0.5 ${clickable} ${mapped ? "bg-ok/20 text-okt" : "bg-pr/25 text-prt"}`;
}

export function highlightPlaceholders(container: HTMLElement, options: PlaceholderRenderOptions = {}) {
  container.querySelectorAll<HTMLElement>("p").forEach((p) => highlightBlock(p, options));

  if (options.onPlaceholderClick) {
    const onClick = options.onPlaceholderClick;
    container.addEventListener("click", (e) => {
      const mark = (e.target as HTMLElement).closest<HTMLElement>("mark[data-placeholder-key]");
      const key = mark?.dataset.placeholderKey;
      if (key) onClick(key);
    });
  }
}

function highlightBlock(root: HTMLElement, options: PlaceholderRenderOptions) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  const nodeStarts: number[] = [];
  let fullText = "";
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    nodeStarts.push(fullText.length);
    fullText += textNode.data;
    textNodes.push(textNode);
  }
  if (!fullText) return;

  const matches: Array<{ start: number; end: number; key: string }> = [];
  let match: RegExpExecArray | null;
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = PLACEHOLDER_REGEX.exec(fullText))) {
    matches.push({ start: match.index, end: match.index + match[0].length, key: match[1] });
  }
  if (matches.length === 0) return;

  textNodes.forEach((textNode, i) => {
    const nodeStart = nodeStarts[i];
    const data = textNode.data;
    const nodeEnd = nodeStart + data.length;
    const overlapping = matches.filter((m) => m.end > nodeStart && m.start < nodeEnd);
    if (overlapping.length === 0) return;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const m of overlapping) {
      const localStart = Math.max(0, m.start - nodeStart);
      const localEnd = Math.min(data.length, m.end - nodeStart);
      if (localStart > cursor) fragment.appendChild(document.createTextNode(data.slice(cursor, localStart)));

      if (m.start >= nodeStart) {
        const mark = document.createElement("mark");
        applyMarkContent(mark, m.key, options);
        fragment.appendChild(mark);
      }
      cursor = localEnd;
    }
    if (cursor < data.length) fragment.appendChild(document.createTextNode(data.slice(cursor)));
    textNode.parentNode?.replaceChild(fragment, textNode);
  });
}

export function syncPlaceholderValues(container: HTMLElement, getValue: (key: string) => string) {
  container.querySelectorAll<HTMLElement>("mark[data-placeholder-key]").forEach((mark) => {
    const key = mark.dataset.placeholderKey;
    if (!key) return;
    applyMarkContent(mark, key, { getValue, onPlaceholderClick: () => {} });
  });
}

export function syncPlaceholderMapping(container: HTMLElement, isMapped: (key: string) => boolean) {
  container.querySelectorAll<HTMLElement>("mark[data-placeholder-key]").forEach((mark) => {
    const key = mark.dataset.placeholderKey;
    if (!key) return;
    applyMarkContent(mark, key, { isMapped, onPlaceholderClick: () => {} });
  });
}
