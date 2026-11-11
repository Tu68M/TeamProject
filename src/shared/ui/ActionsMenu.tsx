import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ActionsMenu({
  children,
  trigger,
  triggerClassName,
  menuClassName,
  ariaLabel = "Действия",
}: {
  children: ReactNode;
  trigger?: ReactNode;
  triggerClassName?: string;
  menuClassName?: string;
  ariaLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.top - 4, right: window.innerWidth - rect.right });
    }
    setIsOpen((o) => !o);
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    function handleScrollOrResize() {
      setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        aria-label={ariaLabel}
        className={
          triggerClassName || "p-1.5 rounded-inp text-tx2 hover:bg-surf hover:text-tx transition-colors cursor-pointer"
        }
      >
        {trigger || (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
          </svg>
        )}
      </button>
      {isOpen && coords && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: coords.top, right: coords.right, transform: "translateY(-100%)" }}
          className={menuClassName || "w-56 bg-bg border border-bd rounded-inp shadow-dropdown z-50 overflow-hidden py-1"}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
}

export function ActionsMenuItem({
  onClick,
  danger,
  disabled,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2 text-[13px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        danger ? "text-dgl hover:bg-dgbg" : "text-tx hover:bg-surf"
      }`}
    >
      {children}
    </button>
  );
}
