"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface ResizableProblemLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftPercent?: number;
  minPanelPx?: number;
}

export default function ResizableProblemLayout({
  left,
  right,
  defaultLeftPercent = 36,
  minPanelPx = 280,
}: ResizableProblemLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerWidth = rect.width;
      const offsetX = e.clientX - rect.left;

      const minPercent = (minPanelPx / containerWidth) * 100;
      const maxPercent = 100 - minPercent;

      const newPercent = Math.min(
        maxPercent,
        Math.max(minPercent, (offsetX / containerWidth) * 100)
      );
      setLeftPercent(newPercent);
    },
    [isDragging, minPanelPx]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 w-full flex-1 ${isMobile ? "flex-col" : "items-stretch"}`}
      style={{ position: "relative" }}
    >
      {/* Left panel */}
      <div
        className={`min-h-0 overflow-y-auto ${isMobile ? "w-full border-b border-border" : "h-full"}`}
        style={isMobile ? { minHeight: 320 } : { width: `${leftPercent}%`, minWidth: minPanelPx }}
      >
        {left}
      </div>

      {/* Draggable divider — desktop only */}
      {!isMobile && (
        <div
          onMouseDown={handleMouseDown}
          className={`
            relative z-10 flex w-1 flex-shrink-0 cursor-col-resize items-center justify-center
            transition-colors duration-150
            ${isDragging ? "bg-[#6aadfe]/40" : "bg-white-700/50 hover:bg-[#6aadfe]/30"}
          `}
          title="Drag to resize"
        >
          <div className="flex flex-col gap-1">
            <span className="block h-1 w-1 rounded-full bg-zinc-400" />
            <span className="block h-1 w-1 rounded-full bg-zinc-400" />
            <span className="block h-1 w-1 rounded-full bg-zinc-400" />
            <span className="block h-1 w-1 rounded-full bg-zinc-400" />
            <span className="block h-1 w-1 rounded-full bg-zinc-400" />
          </div>
        </div>
      )}

      {/* Right panel */}
      <div
        className={`min-h-0 overflow-y-auto ${isMobile ? "w-full flex-1" : "h-full"}`}
        style={isMobile ? { minHeight: 320 } : { width: `${100 - leftPercent}%`, minWidth: minPanelPx }}
      >
        {right}
      </div>

      {/* Overlay while dragging */}
      {isDragging && !isMobile && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}
    </div>
  );
}
