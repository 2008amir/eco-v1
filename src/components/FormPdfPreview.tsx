import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

function PdfPage({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !canvas.current) return;
    let cancelled = false;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    const draw = async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvas.current) return;
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const target = canvas.current;
      target.width = Math.floor(viewport.width * pixelRatio);
      target.height = Math.floor(viewport.height * pixelRatio);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      const context = target.getContext("2d");
      if (!context) return;
      task = page.render({ canvas: target, canvasContext: context, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      try { await task.promise; } catch (error) { if (!cancelled) console.error("Could not draw form page", error); }
    };
    void draw().catch((error) => { if (!cancelled) console.error("Could not load form page", error); });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, pageNumber, width]);

  return <div ref={wrapper} className="w-full bg-card shadow-sm"><canvas ref={canvas} className="block max-w-full" aria-label={`Form page ${pageNumber}`} role="img" /></div>;
}

export function FormPdfPreview({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let loaded: PDFDocumentProxy | undefined;
    setPdf(null);
    setError(false);
    const load = async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const task = pdfjs.getDocument(url);
      try {
        loaded = await task.promise;
        if (active) setPdf(loaded);
        else await loaded.destroy();
      } catch (cause) {
        if (active) { console.error("Could not preview form", cause); setError(true); }
      }
    };
    void load();
    return () => { active = false; if (loaded) void loaded.destroy(); };
  }, [url]);

  if (error) return <p className="text-sm text-destructive" role="alert">The preview could not be displayed. You can still download the form.</p>;
  if (!pdf) return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">Preparing form preview…</div>;
  return <div className="space-y-4" aria-label="Form PDF preview">{Array.from({ length: pdf.numPages }, (_, index) => <PdfPage key={index} pdf={pdf} pageNumber={index + 1} />)}</div>;
}