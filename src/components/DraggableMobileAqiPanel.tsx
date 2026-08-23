import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripHorizontal } from "lucide-react";

type Position = { x: number; y: number };
function savedPosition(positionKey: string): Position | null {
  try { const value = JSON.parse(localStorage.getItem(positionKey) || "null"); return Number.isFinite(value?.x) && Number.isFinite(value?.y) ? value : null; } catch { return null; }
}

export function DraggableMobileAqiPanel({ mapContainerRef, summary, children, className = "", storagePrefix = "cleanAirMobileAqiPanel" }: { mapContainerRef: React.RefObject<HTMLDivElement | null>; summary: string; children: ReactNode; className?: string; storagePrefix?: string }) {
  const positionKey = `${storagePrefix}Position`;
  const minimizedKey = `${storagePrefix}Minimized`;
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ id: number; origin: Position; x: number; y: number } | null>(null);
  const [position, setPosition] = useState<Position>({ x: 8, y: 8 });
  const [dragging, setDragging] = useState(false);
  const [minimized, setMinimized] = useState(() => localStorage.getItem(minimizedKey) === "true");
  const bounds = useCallback(() => {
    const container = mapContainerRef.current, panel = panelRef.current;
    if (!container || !panel) return null;
    const map = container.getBoundingClientRect(), panelBox = panel.getBoundingClientRect();
    const selector = container.querySelector<HTMLElement>("[data-map-mode-selector]")?.getBoundingClientRect();
    const nav = document.querySelector<HTMLElement>("[data-mobile-bottom-nav]")?.getBoundingClientRect();
    const top = Math.max(8, (selector?.bottom || map.top) - map.top + 8);
    // Reserve the measured navigation height even if the map and nav happen
    // to meet exactly at their edges, so the card never slips behind it.
    const navReserve = nav ? nav.height + Math.max(0, map.bottom - nav.top) : 0;
    return { left: 8, right: Math.max(8, map.width - panelBox.width - 8), top, bottom: Math.max(top, map.height - panelBox.height - navReserve - 8) };
  }, [mapContainerRef]);
  const clamp = useCallback((value: Position) => { const edge = bounds(); return edge ? { x: Math.max(edge.left, Math.min(edge.right, value.x)), y: Math.max(edge.top, Math.min(edge.bottom, value.y)) } : value; }, [bounds]);
  const restore = useCallback(() => { const edge = bounds(); if (edge) setPosition(clamp(savedPosition(positionKey) || { x: (edge.left + edge.right) / 2, y: edge.bottom })); }, [bounds, clamp, positionKey]);
  useLayoutEffect(() => { restore(); }, [restore, minimized]);
  useEffect(() => { const resize = () => setPosition((value) => clamp(value)); window.addEventListener("resize", resize); window.addEventListener("orientationchange", resize); return () => { window.removeEventListener("resize", resize); window.removeEventListener("orientationchange", resize); }; }, [clamp]);
  const endDrag = useCallback((snap: boolean) => {
    if (!dragRef.current) return;
    dragRef.current = null; setDragging(false);
    setPosition((current) => { const edge = bounds(); if (!edge) return current; const next = clamp(current); const final = snap ? { x: next.x < (edge.left + edge.right) / 2 ? Math.max(edge.left, 64) : edge.right, y: next.y < (edge.top + edge.bottom) / 2 ? edge.top : edge.bottom } : next; try { localStorage.setItem(positionKey, JSON.stringify(final)); } catch {} return final; });
  }, [bounds, clamp, positionKey]);
  const down = (event: React.PointerEvent<HTMLDivElement>) => { if (window.matchMedia("(min-width: 769px)").matches) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { id: event.pointerId, origin: position, x: event.clientX, y: event.clientY }; setDragging(true); };
  const move = (event: React.PointerEvent<HTMLDivElement>) => { const active = dragRef.current; if (!active || active.id !== event.pointerId) return; event.preventDefault(); event.stopPropagation(); setPosition(clamp({ x: active.origin.x + event.clientX - active.x, y: active.origin.y + event.clientY - active.y })); };
  const up = (event: React.PointerEvent<HTMLDivElement>) => { if (dragRef.current?.id === event.pointerId) { event.stopPropagation(); endDrag(true); } };
  const toggle = () => setMinimized((current) => { const next = !current; try { localStorage.setItem(minimizedKey, String(next)); } catch {} return next; });
  return <article ref={panelRef} className={`mobile-aqi-panel absolute z-[700] rounded-2xl border border-slate-900 bg-slate-950/95 shadow-2xl backdrop-blur-md pointer-events-auto text-slate-200 ${className} ${dragging ? "mobile-aqi-panel-dragging" : ""} ${minimized ? "mobile-aqi-panel-minimized" : ""}`} style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}>
    <div className="lg:hidden flex min-h-11 items-center gap-2 border-b border-slate-900 px-3"><div role="button" tabIndex={0} aria-label="Move Air Quality panel" className="mobile-aqi-drag-handle flex min-h-10 flex-1 items-center justify-center" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><GripHorizontal size={22} className="text-slate-500" /></div><button type="button" onClick={toggle} className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/[.06] hover:text-white" aria-label={minimized ? "Expand Air Quality panel" : "Minimize Air Quality panel"}>{minimized ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button></div>
    {minimized && <div className="lg:hidden flex h-9 items-center px-3 text-xs font-semibold text-slate-200">{summary}</div>}
    <div className={minimized ? "hidden lg:block" : ""} onPointerDown={(event) => event.stopPropagation()} onWheelCapture={(event) => event.stopPropagation()}>{children}</div>
  </article>;
}
