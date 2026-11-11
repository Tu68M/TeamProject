import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DocxViewer, ImageViewer } from "@shared/ui/DocumentViewers";
import { getImageMimeType, type PreviewKind } from "@shared/utils/fileType";

interface FilePreviewModalProps {
  blob: Blob;
  filename: string;
  kind: PreviewKind;
  onClose: () => void;
}

export function FilePreviewModal({ blob, filename, kind, onClose }: FilePreviewModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (kind === "docx") return;
    const type = kind === "pdf" ? "application/pdf" : getImageMimeType(filename);
    const url = URL.createObjectURL(new Blob([blob], { type }));
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob, filename, kind]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-bg rounded-lg border border-bd w-full h-full max-w-[1400px] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-bd shrink-0">
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold text-tx">Предпросмотр</h3>
            <span className="text-[12px] text-tx2 truncate block" title={filename}>{filename}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="shrink-0 text-tx2 hover:text-tx transition-colors cursor-pointer">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {kind === "docx" && <DocxViewer data={blob} />}
        {kind === "image" && objectUrl && <ImageViewer src={objectUrl} alt={filename} />}
        {kind === "pdf" && objectUrl && (
          <iframe src={`${objectUrl}#view=Fit`} title={filename} className="flex-1 min-h-0 w-full bg-bg border-0" />
        )}
      </div>
    </div>,
    document.body
  );
}
