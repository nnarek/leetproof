"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface ResizableProblemLayoutProps {
  /** Left panel content (problem description) */
  left: React.ReactNode;
  /** Right panel content (editor) */
  right: React.ReactNode;
  /** Initial width of the left panel as a percentage (0–100). Default 36. */
  defaultLeftPercent?: number;
  /** Minimum width for either panel in pixels. Default 280. */
  minPanelPx?: number;
}

/**
 * A horizontally-resizable two-panel layout.
 * The user can drag the divider to resize the description vs editor panels.
 */
export default function ResizableProblemLayout({
  left,
  right,
  defaultLeftPercent = 36,
  minPanelPx = 280,
}: ResizableProblemLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [isDragging, setIsDragging] = useState(false);

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

      // Clamp so neither panel gets smaller than minPanelPx
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

  // Attach window-level listeners while dragging so the cursor can leave the divider
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
      className="flex min-h-0 w-full flex-1 items-stretch"
      style={{ position: "relative" }}
    >
      {/* Left panel */}
      <div
        className="h-full min-h-0 overflow-y-auto"
        style={{ width: `${leftPercent}%`, minWidth: minPanelPx }}
      >
        {left}
      </div>

      {/* Draggable divider */}
      <div
        onMouseDown={handleMouseDown}
        className={`
          relative z-10 flex w-1 flex-shrink-0 cursor-col-resize items-center justify-center
          transition-colors duration-150
          ${isDragging ? "bg-[#6aadfe]/40" : "bg-white-700/50 hover:bg-[#6aadfe]/30"}
        `}
        title="Drag to resize"
      >
        {/* Visual grip dots */}
        <div className="flex flex-col gap-1">
          <span className="block h-1 w-1 rounded-full bg-zinc-400" />
          <span className="block h-1 w-1 rounded-full bg-zinc-400" />
          <span className="block h-1 w-1 rounded-full bg-zinc-400" />
          <span className="block h-1 w-1 rounded-full bg-zinc-400" />
          <span className="block h-1 w-1 rounded-full bg-zinc-400" />
        </div>
      </div>

      {/* Right panel */}
      <div
        className="h-full min-h-0 overflow-y-auto"
        style={{ width: `${100 - leftPercent}%`, minWidth: minPanelPx }}
      >
        {right}
      </div>

      {/* Overlay while dragging — prevents iframe from capturing mouse events */}
      {isDragging && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}
    </div>
  );
}
