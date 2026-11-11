import { useEffect, useRef, useState, type RefObject } from "react";
import { renderAsync } from "docx-preview";

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.25;
const FIT_MARGIN = 16;
const DOCX_WRAPPER_PADDING = 60;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

function usePaneSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

function useZoom(fitScale: number, paneRef: RefObject<HTMLDivElement | null>) {
  const [factor, setFactor] = useState(1);
  const scale = clampScale(fitScale * factor);

  const zoomBy = (multiplier: number) => setFactor((f) => clampScale(fitScale * f * multiplier) / fitScale);
  const zoomByRef = useRef(zoomBy);
  useEffect(() => {
    zoomByRef.current = zoomBy;
  });

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomByRef.current(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    };
    pane.addEventListener("wheel", onWheel, { passive: false });
    return () => pane.removeEventListener("wheel", onWheel);
  }, [paneRef]);

  return {
    scale,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    reset: () => setFactor(1),
  };
}

function ZoomToolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const btn =
    "min-w-[32px] h-8 px-2 text-[14px] font-medium text-tx hover:bg-surf transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default";
  return (
    <div className="absolute top-3 right-5 z-10 flex items-center rounded-inp border border-bd bg-bg shadow-md overflow-hidden divide-x divide-bd">
      <button type="button" className={btn} onClick={onZoomOut} disabled={scale <= MIN_SCALE} aria-label="Уменьшить" title="Уменьшить">
        −
      </button>
      <span className="min-w-[52px] px-2 text-center text-[13px] text-tx2 tabular-nums select-none">{Math.round(scale * 100)}%</span>
      <button type="button" className={btn} onClick={onZoomIn} disabled={scale >= MAX_SCALE} aria-label="Увеличить" title="Увеличить">
        +
      </button>
      <button type="button" className={`${btn} text-[13px]`} onClick={onReset} title="Вписать страницу в экран">
        По размеру
      </button>
    </div>
  );
}

export function DocxViewer({ data, onRendered }: { data: Blob; onRendered?: (container: HTMLElement) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: paneRef, size } = usePaneSize();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);

  const onRenderedRef = useRef(onRendered);
  useEffect(() => {
    onRenderedRef.current = onRendered;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    setStatus("loading");
    const host = document.createElement("div");
    container.replaceChildren(host);
    renderAsync(data, host, host, {
      className: "docx-preview",
      inWrapper: true,
      breakPages: true,
      renderFootnotes: false,
      renderEndnotes: false,
      useBase64URL: true,
    })
      .then(() => {
        if (cancelled) return;
        const page = container.querySelector<HTMLElement>("section");
        if (page) setPageSize({ w: page.offsetWidth, h: page.offsetHeight });
        onRenderedRef.current?.(container);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Ошибка отрисовки предпросмотра документа:", err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      host.remove();
    };
  }, [data]);

  const fitScale =
    pageSize && size.w > 0 && size.h > 0
      ? clampScale(
          Math.min(
            1,
            (size.w - FIT_MARGIN) / (pageSize.w + DOCX_WRAPPER_PADDING),
            (size.h - FIT_MARGIN) / (pageSize.h + DOCX_WRAPPER_PADDING)
          )
        )
      : 1;
  const { scale, zoomIn, zoomOut, reset } = useZoom(fitScale, paneRef);

  return (
    <div className="relative flex-1 min-h-0 min-w-0">
      <div ref={paneRef} className="absolute inset-0 overflow-auto bg-[gray]">
        <div
          ref={containerRef}
          className={`theme-light w-fit mx-auto ${status === "error" ? "hidden" : ""}`}
          style={{ zoom: scale }}
        />
      </div>
      {status === "ready" && <ZoomToolbar scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} />}
      {status !== "ready" && (
        <div className={`absolute inset-0 flex items-center justify-center p-4 text-[13px] pointer-events-none ${status === "error" ? "text-dgl bg-bg" : "text-white"}`}>
          {status === "error" ? "Не удалось отобразить документ. Попробуйте скачать файл." : "Отрисовка документа..."}
        </div>
      )}
    </div>
  );
}

export function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const { ref: paneRef, size } = usePaneSize();
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const fitScale =
    natural && size.w > 0 && size.h > 0
      ? clampScale(Math.min(1, (size.w - FIT_MARGIN) / natural.w, (size.h - FIT_MARGIN) / natural.h))
      : 1;
  const { scale, zoomIn, zoomOut, reset } = useZoom(fitScale, paneRef);

  return (
    <div className="relative flex-1 min-h-0 min-w-0">
      <div ref={paneRef} className="absolute inset-0 overflow-auto bg-ntbg">
        <div className="min-w-full min-h-full w-fit flex items-center justify-center p-2">
          <img
            src={src}
            alt={alt}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={natural ? { width: natural.w * scale, maxWidth: "none" } : { visibility: "hidden" }}
            className="shrink-0 bg-white shadow-md"
            draggable={false}
          />
        </div>
      </div>
      {natural && <ZoomToolbar scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} />}
    </div>
  );
}
