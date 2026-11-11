import { useEffect, useRef, useState } from "react";

const VIEWPORT_SIZE = 260;
const OUTPUT_SIZE = 512;
const MAX_ZOOM = 3;

interface Position {
  x: number;
  y: number;
}

interface AvatarCropModalProps {
  file: File;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}

export default function AvatarCropModal({ file, onCancel, onConfirm }: AvatarCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Position>({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const dragRef = useRef<{ startX: number; startY: number; origin: Position } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!imageUrl) return null;

  const baseScale = natural ? VIEWPORT_SIZE / Math.min(natural.width, natural.height) : 1;
  const scale = baseScale * zoom;
  const displayWidth = natural ? natural.width * scale : 0;
  const displayHeight = natural ? natural.height * scale : 0;

  function clampPos(next: Position, width: number, height: number): Position {
    const maxX = Math.max(0, (width - VIEWPORT_SIZE) / 2);
    const maxY = Math.max(0, (height - VIEWPORT_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: pos };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const next = { x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy };
    setPos(clampPos(next, displayWidth, displayHeight));
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom);
    if (!natural) return;
    const nextScale = baseScale * nextZoom;
    setPos((prev) => clampPos(prev, natural.width * nextScale, natural.height * nextScale));
  }

  async function handleConfirm() {
    if (!natural) return;
    setIsSaving(true);
    try {
      const img = new Image();
      img.src = imageUrl!;
      await img.decode();

      const cropLeftInDisplay = (displayWidth - VIEWPORT_SIZE) / 2 - pos.x;
      const cropTopInDisplay = (displayHeight - VIEWPORT_SIZE) / 2 - pos.y;
      const sx = cropLeftInDisplay / scale;
      const sy = cropTopInDisplay / scale;
      const sSize = VIEWPORT_SIZE / scale;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context unavailable");
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
      if (!blob) throw new Error("не удалось создать изображение");

      onConfirm(new File([blob], "avatar.png", { type: "image/png" }));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-bg rounded-card border border-bd w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <h3 className="text-[16px] font-medium text-tx">Обрезка фото</h3>
          <button onClick={onCancel} className="text-tx2 hover:text-tx transition-colors" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-4 flex flex-col items-center gap-4">
          <div
            className="relative overflow-hidden rounded-full bg-ntbg touch-none cursor-grab active:cursor-grabbing select-none"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ width: el.naturalWidth, height: el.naturalHeight });
              }}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: displayWidth || undefined,
                height: displayHeight || undefined,
                transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`,
                maxWidth: "none",
              }}
            />
          </div>

          <div className="w-full flex items-center gap-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-tx2 shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="flex-1 accent-pr"
            />
          </div>
          <div className="text-[12px] leading-[16px] text-tx2 -mt-2 self-start">
            Перетащите фото и настройте масштаб, чтобы выбрать область для аватарки.
          </div>
        </div>

        <div className="flex gap-2 justify-end p-4 border-t border-bd">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-3 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving || !natural}
            className="px-3 py-2 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50"
          >
            {isSaving ? "Сохранение..." : "Обрезать и сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
