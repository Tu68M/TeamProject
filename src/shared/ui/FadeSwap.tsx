import { useEffect, useRef, useState, type ReactNode } from "react";

interface FadeSwapProps {
  showSkeleton: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}

export function FadeSwap({ showSkeleton, skeleton, children }: FadeSwapProps) {
  const hadSkeletonRef = useRef(showSkeleton);

  const [phase, setPhase] = useState<"skeleton" | "fading" | "content">(
    showSkeleton ? "skeleton" : "content"
  );

  useEffect(() => {
    if (showSkeleton) {
      hadSkeletonRef.current = true;
      setPhase("skeleton");
      return;
    }

    if (!hadSkeletonRef.current) {
      setPhase("content");
      return;
    }

    setPhase("fading");
    const timeout = setTimeout(() => setPhase("content"), 300);
    return () => clearTimeout(timeout);
  }, [showSkeleton]);

  if (phase === "skeleton") {
    return <div className="animate-pulse">{skeleton}</div>;
  }

  if (phase === "fading") {
    return (
      <div className="opacity-0 transition-opacity duration-300 ease-out">
        {skeleton}
      </div>
    );
  }

  return <div className="animate-fadeIn">{children}</div>;
}