import { useEffect, useRef, useState } from "react";
import { api } from "@shared/api/axiosInstance";

const AVATAR_CACHE_TTL_MS = 10 * 60 * 1000;
const AVATAR_MISSING_TTL_MS = 10 * 60 * 1000;
const AVATAR_ERROR_TTL_MS = 30 * 1000;
const AVATAR_RATE_LIMITED_TTL_MS = 60 * 1000;
const MISSING_STORAGE_KEY = "avatar-missing";

interface CacheEntry {
  objectUrl: string;
  cachedAt: number;
}

const objectUrlCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();
const skipUntil = new Map<string, number>();

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt < AVATAR_CACHE_TTL_MS;
}

function readMissingFromStorage(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(MISSING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeMissingToStorage(map: Record<string, number>) {
  try {
    sessionStorage.setItem(MISSING_STORAGE_KEY, JSON.stringify(map));
  } catch {
  }
}

let storageHydrated = false;
function hydrateMissingOnce() {
  if (storageHydrated) return;
  storageHydrated = true;
  const now = Date.now();
  const stored = readMissingFromStorage();
  for (const [url, until] of Object.entries(stored)) {
    if (until > now) skipUntil.set(url, until);
  }
}

function markSkipped(url: string, ttlMs: number, persist: boolean) {
  const until = Date.now() + ttlMs;
  skipUntil.set(url, until);
  if (persist) {
    const stored = readMissingFromStorage();
    stored[url] = until;
    const now = Date.now();
    for (const key of Object.keys(stored)) {
      if (stored[key] <= now) delete stored[key];
    }
    writeMissingToStorage(stored);
  }
}

function isSkipped(url: string): boolean {
  hydrateMissingOnce();
  const until = skipUntil.get(url);
  if (until === undefined) return false;
  if (until > Date.now()) return true;
  skipUntil.delete(url);
  return false;
}

export function invalidateAvatarCache() {
  objectUrlCache.clear();
  skipUntil.clear();
  try {
    sessionStorage.removeItem(MISSING_STORAGE_KEY);
  } catch {
  }
}

function loadAvatar(url: string): Promise<string | null> {
  const cached = objectUrlCache.get(url);
  if (cached && isFresh(cached)) return Promise.resolve(cached.objectUrl);

  if (isSkipped(url)) return Promise.resolve(cached?.objectUrl ?? null);

  const existing = inFlight.get(url);
  if (existing) return existing;

  const promise = api
    .get(url, { responseType: "blob" })
    .then((res) => {
      const objectUrl = URL.createObjectURL(res.data);
      const old = objectUrlCache.get(url);
      if (old) URL.revokeObjectURL(old.objectUrl);
      objectUrlCache.set(url, { objectUrl, cachedAt: Date.now() });
      skipUntil.delete(url);
      return objectUrl;
    })
    .catch((err) => {
      const status = err?.response?.status;
      if (status === 404) {
        markSkipped(url, AVATAR_MISSING_TTL_MS, true);
      } else if (status === 429) {
        markSkipped(url, AVATAR_RATE_LIMITED_TTL_MS, false);
      } else {
        markSkipped(url, AVATAR_ERROR_TTL_MS, false);
      }
      return cached?.objectUrl ?? null;
    })
    .finally(() => inFlight.delete(url));

  inFlight.set(url, promise);
  return promise;
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

interface AvatarProps {
  avatarUrl?: string | null;
  name: string;
  size?: number;
  rounded?: string;
  className?: string;
}

export default function Avatar({ avatarUrl, name, size = 40, rounded = "rounded-full", className = "" }: AvatarProps) {
  const cachedEntry = avatarUrl ? objectUrlCache.get(avatarUrl) : undefined;
  const [src, setSrc] = useState<string | null>(cachedEntry?.objectUrl || null);
  const [visibleFor, setVisibleFor] = useState<string | null>(() =>
    avatarUrl && (cachedEntry || isSkipped(avatarUrl)) ? avatarUrl : null
  );
  const placeholderRef = useRef<HTMLDivElement>(null);
  const isVisible = Boolean(avatarUrl) && visibleFor === avatarUrl;

  useEffect(() => {
    if (!avatarUrl || isVisible) return;
    const el = placeholderRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisibleFor(avatarUrl);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleFor(avatarUrl);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [avatarUrl, isVisible]);

  useEffect(() => {
    if (!avatarUrl) {
      setSrc(null);
      return;
    }
    const cached = objectUrlCache.get(avatarUrl);
    if (cached) {
      setSrc(cached.objectUrl);
      if (isFresh(cached)) return;
    } else {
      setSrc(null);
    }
    if (!isVisible) return;

    let cancelled = false;
    loadAvatar(avatarUrl).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl, isVisible]);

  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={`${rounded} object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      ref={placeholderRef}
      style={style}
      className={`${rounded} bg-pr text-white flex items-center justify-center font-semibold shrink-0 ${className}`}
    >
      {initialsOf(name || "") || "?"}
    </div>
  );
}
