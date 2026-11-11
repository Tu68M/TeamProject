
const OVERLAY_CLASSES = ["fixed", "inset-0", "flex", "items-center", "justify-center", "backdrop-blur-sm"];
const EXIT_MS = 160;

function isModalOverlay(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && OVERLAY_CLASSES.every((c) => node.classList.contains(c));
}

export function initModalExitAnimation(): void {
  if (typeof MutationObserver === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.removedNodes.forEach((node) => {
        if (!isModalOverlay(node) || node.classList.contains("modal-exit")) return;
        const ghost = node.cloneNode(true) as HTMLElement;
        ghost.removeAttribute("id");
        ghost.setAttribute("aria-hidden", "true");
        ghost.querySelectorAll("iframe, video, audio").forEach((el) => {
          (el as HTMLElement).style.visibility = "hidden";
        });
        ghost.classList.add("modal-exit");
        document.body.appendChild(ghost);
        window.setTimeout(() => ghost.remove(), EXIT_MS);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
