import { useEffect, useState } from "react";
import { dictionaryApi } from "@entities/dictionary/dictionaryApi";

export interface ViolationTypeOption {
  code: string;
  name: string;
}

export function useViolationTypes() {
  const [violationTypes, setViolationTypes] = useState<ViolationTypeOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    dictionaryApi
      .getBriefViolationTypes()
      .then((result) => {
        if (cancelled) return;
        const list = Array.isArray(result) ? result : [result];
        setViolationTypes(
          list
            .filter((v) => v.code && v.isActive !== false)
            .map((v) => ({ code: v.code as string, name: v.name || (v.code as string) }))
            .sort((a, b) => a.name.localeCompare(b.name, "ru"))
        );
      })
      .catch((err) => console.error("Не удалось загрузить виды нарушений:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { violationTypes, loading };
}
