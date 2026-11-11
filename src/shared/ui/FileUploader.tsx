import { useState } from "react";
import { getFileTypeStyle } from "@shared/utils/fileType";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { formatNowDate } from "@shared/utils/datetime";

export interface FileItem {
  id: string;
  name: string;
  sizeLabel: string;
  addedAt: string;
  isPending?: boolean;
}

interface FileUploaderProps {
  files?: FileItem[];
  onFilesAdd: (files: FileList | File[]) => void;
  onFileRemove: (id: string) => void;
  maxSizeMB?: number;
  acceptedFormats?: string;
  label?: string;
  disabled?: boolean;
}

export function FileUploader({
  files = [],
  onFilesAdd,
  onFileRemove,
  maxSizeMB = 25,
  acceptedFormats = ".pdf,.docx,.jpg,.png,.jpeg",
  label = "Прикреплённые файлы",
  disabled = false,
}: FileUploaderProps) {
  const [isDraggingOver, setDraggingOver] = useState(false);
  const { timezone } = useTimezoneStore();

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdd(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesAdd(e.dataTransfer.files);
    }
  };

  const formattedFormats = acceptedFormats
    .replace(/\./g, "")
    .toUpperCase()
    .replace(/,/g, ", ");

  const defaultAddedAt = formatNowDate(timezone);

  return (
    <div className="flex flex-col gap-3 w-full">
      <span className="text-[14px] font-medium text-tx">{label}</span>
      
      {!disabled && (
        <div
          className={`flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-card transition-colors cursor-pointer
            ${isDraggingOver 
              ? "border-pr bg-pr/5 text-prl" 
              : "border-bd bg-surf text-tx2 hover:border-pr/50 hover:bg-pr/5"
            }`}
          onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={handleDrop}
        >
          <svg className="shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5" />
            <path d="M4 17v3h16v-3" />
          </svg>
          
          <div className="text-center">
            <span className="text-[14px] font-medium text-tx block mb-1">Перетащите файлы сюда</span>
            <span className="text-[12px] text-tx2">{formattedFormats} · до {maxSizeMB} МБ</span>
          </div>

          <label className="mt-1 px-4 py-2 rounded-inp text-[14px] font-medium bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors cursor-pointer">
            Выбрать файлы
            <input
              type="file"
              multiple
              accept={acceptedFormats}
              className="hidden"
              onChange={handleFileInputChange}
            />
          </label>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {files.map((f) => {
          const style = getFileTypeStyle(f.name);
          return (
          <div key={f.id} className="flex items-center gap-3 p-3 border border-bd rounded-inp bg-bg transition-colors hover:border-pr/30">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${style.badgeClass}`}>
              {style.label}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[14px] leading-[20px] text-tx truncate" title={f.name}>
                {f.name}
              </div>
              <div className="text-[12px] leading-[16px] text-tx2">
                {f.sizeLabel} · добавлен {f.addedAt || defaultAddedAt}
                {f.isPending && <span className="text-prl ml-1">(загружается...)</span>}
              </div>
            </div>
            
            {!disabled && (
              <button
                type="button"
                className="shrink-0 px-2 py-1 text-[14px] font-medium text-dgl hover:text-dgt hover:bg-dgbg rounded transition-colors"
                onClick={() => onFileRemove(f.id)}
                title="Удалить файл"
              >
                Удалить
              </button>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}