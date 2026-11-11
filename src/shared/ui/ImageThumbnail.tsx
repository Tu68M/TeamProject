import { useEffect, useRef, useState } from "react";
import { caseApi } from "@/entities/case/api/caseApi";
import { getFileTypeStyle } from "@shared/utils/fileType";

const MAX_CACHED = 100;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function remember(key: string, url: string) {
  cache.set(key, url);
  if (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      const old = cache.get(oldest);
      cache.delete(oldest);
      if (old) URL.revokeObjectURL(old);
    }
  }
}

function loadThumbnail(downloadUrl: string): Promise<string> {
  const cached = cache.get(downloadUrl);
  if (cached) return Promise.resolve(cached);
  let pending = inflight.get(downloadUrl);
  if (!pending) {
    const thumbnailUrl = downloadUrl.replace(/\/download$/, "/thumbnail");
    pending = caseApi
      .fetchDocumentBlob(thumbnailUrl)
      .catch(() => caseApi.fetchDocumentBlob(downloadUrl))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        remember(downloadUrl, url);
        return url;
      })
      .finally(() => inflight.delete(downloadUrl));
    inflight.set(downloadUrl, pending);
  }
  return pending;
}

interface ImageThumbnailProps {
  filename?: string | null;
  downloadUrl?: string | null;
  file?: File;
  size?: number;
  onOpen?: () => void;
  dimmed?: boolean;
}

export function ImageThumbnail({ filename, downloadUrl, file, size = 48, onOpen, dimmed }: ImageThumbnailProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(() => (downloadUrl ? (cache.get(downloadUrl) ?? null) : null));
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = holderRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || src) return;
    if (file) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    if (!downloadUrl) return;
    let cancelled = false;
    loadThumbnail(downloadUrl)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, src, file, downloadUrl]);

  const style = getFileTypeStyle(filename);
  const boxStyle = { width: size, height: size };
  const common = `shrink-0 rounded-md overflow-hidden border border-bd bg-surf ${dimmed ? "opacity-50" : ""}`;

  const content = src ? (
    <img src={src} alt={filename || "Изображение"} className="w-full h-full object-cover" draggable={false} />
  ) : failed ? (
    <span className={`w-full h-full flex items-center justify-center text-[10px] font-bold ${style.badgeClass}`}>
      {style.label}
    </span>
  ) : (
    <span className="block w-full h-full bg-skel animate-pulse" aria-hidden="true" />
  );

  if (onOpen && src) {
    return (
      <div ref={holderRef} className={common} style={boxStyle}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Открыть ${filename || "изображение"}`}
          className="block w-full h-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
        >
          {content}
        </button>
      </div>
    );
  }
  return (
    <div ref={holderRef} className={common} style={boxStyle}>
      {content}
    </div>
  );
}
