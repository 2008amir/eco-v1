import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Underline as UnderlineIcon, Type, Palette, Upload, X, Check, Image as ImageIcon, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uploadWithSupabaseRetry } from "@/lib/supabase-retry";
import { toast } from "sonner";

type Props = {
  initialHtml: string;
  onCancel: () => void;
  onDone: (html: string) => void;
};

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72, 96];

// CSS selector for elements that are likely text content (not pure containers)
const TEXT_TAGS = "h1,h2,h3,h4,h5,h6,p,span,a,blockquote,li,td,th,figcaption,strong,em,small,label,button";

export function TemplateInlineEditor({ initialHtml, onCancel, onDone }: Props) {
  const { user } = useAuth();
  const stageRef = useRef<HTMLDivElement>(null);
  const [textToolbar, setTextToolbar] = useState<{ left: number; top: number; el: HTMLElement } | null>(null);
  const [mediaToolbar, setMediaToolbar] = useState<{ left: number; top: number; el: HTMLElement } | null>(null);
  const [uploading, setUploading] = useState(false);
  const replaceImgRef = useRef<HTMLInputElement>(null);
  const replaceVidRef = useRef<HTMLInputElement>(null);
  const insertImgRef = useRef<HTMLInputElement>(null);
  const insertVidRef = useRef<HTMLInputElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Inject the template HTML once
  useEffect(() => {
    if (!stageRef.current) return;
    stageRef.current.innerHTML = initialHtml;
  }, [initialHtml]);

  const closeToolbars = useCallback(() => {
    if (textToolbar) {
      textToolbar.el.removeAttribute("contenteditable");
      textToolbar.el.style.outline = "";
    }
    setTextToolbar(null);
    setMediaToolbar(null);
  }, [textToolbar]);

  const positionToolbarFor = (el: HTMLElement): { left: number; top: number } => {
    const rect = el.getBoundingClientRect();
    const top = Math.max(60, rect.top - 50);
    const left = Math.min(window.innerWidth - 320, Math.max(8, rect.left));
    return { left, top };
  };

  const handleStageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target || !stageRef.current?.contains(target)) return;

    // Image / video / iframe
    const media = target.closest("img, video, iframe") as HTMLElement | null;
    if (media) {
      e.preventDefault();
      e.stopPropagation();
      closeToolbars();
      setMediaToolbar({ ...positionToolbarFor(media), el: media });
      return;
    }

    // Text element
    const textEl = target.closest(TEXT_TAGS) as HTMLElement | null;
    if (textEl && stageRef.current.contains(textEl)) {
      e.preventDefault();
      e.stopPropagation();
      // Close any previous text edit
      if (textToolbar && textToolbar.el !== textEl) {
        textToolbar.el.removeAttribute("contenteditable");
        textToolbar.el.style.outline = "";
      }
      textEl.setAttribute("contenteditable", "true");
      textEl.style.outline = "2px dashed hsl(var(--primary))";
      textEl.focus();
      setMediaToolbar(null);
      setTextToolbar({ ...positionToolbarFor(textEl), el: textEl });
    }
  };

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
  };

  const setFontSize = (px: number) => {
    if (!textToolbar) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && textToolbar.el.contains(sel.anchorNode)) {
      // Wrap selection in span with font-size
      const range = sel.getRangeAt(0);
      const span = document.createElement("span");
      span.style.fontSize = `${px}px`;
      try {
        span.appendChild(range.extractContents());
        range.insertNode(span);
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
      } catch { /* ignore */ }
    } else {
      // Apply to whole element
      textToolbar.el.style.fontSize = `${px}px`;
    }
  };

  const setColor = (color: string) => {
    if (!textToolbar) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && textToolbar.el.contains(sel.anchorNode)) {
      exec("foreColor", color);
    } else {
      textToolbar.el.style.color = color;
    }
  };

  const uploadFile = async (file: File, kind: "image" | "video"): Promise<string | null> => {
    if (!user) { toast.error("Sign in required"); return null; }
    const max = kind === "image" ? 10 : 100;
    if (file.size > max * 1024 * 1024) { toast.error(`Max ${max}MB`); return null; }
    const ext = file.name.split(".").pop() || (kind === "image" ? "png" : "mp4");
    const path = `${user.id}/${kind}/${Date.now()}.${ext}`;
    setUploading(true);
    const { error } = await uploadWithSupabaseRetry("research-media", path, file, { contentType: file.type }, 6);
    setUploading(false);
    if (error) { toast.error(error.message || "Upload failed"); return null; }
    const { data } = supabase.storage.from("research-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const onReplaceImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !mediaToolbar) return;
    const url = await uploadFile(f, "image");
    if (!url) return;
    if (mediaToolbar.el.tagName === "IMG") {
      (mediaToolbar.el as HTMLImageElement).src = url;
    } else {
      // replace with an <img> at same position
      const img = document.createElement("img");
      img.src = url;
      img.style.cssText = mediaToolbar.el.getAttribute("style") || "max-width:100%;height:auto;";
      mediaToolbar.el.replaceWith(img);
      setMediaToolbar({ ...positionToolbarFor(img), el: img });
    }
    toast.success("Image replaced");
  };

  const onReplaceVid = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f || !mediaToolbar) return;
    const url = await uploadFile(f, "video");
    if (!url) return;
    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.style.cssText = mediaToolbar.el.getAttribute("style") || "max-width:100%;height:auto;";
    mediaToolbar.el.replaceWith(video);
    setMediaToolbar({ ...positionToolbarFor(video), el: video });
    toast.success("Video replaced");
  };

  const insertNewImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const url = await uploadFile(f, "image");
    if (!url) return;
    const img = document.createElement("img");
    img.src = url;
    img.style.cssText = "max-width:100%;height:auto;display:block;margin:1rem auto;";
    stageRef.current?.appendChild(img);
    toast.success("Image added");
  };
  const insertNewVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const url = await uploadFile(f, "video");
    if (!url) return;
    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.style.cssText = "max-width:100%;height:auto;display:block;margin:1rem auto;";
    stageRef.current?.appendChild(video);
    toast.success("Video added");
  };
  const insertNewTextBox = () => {
    const box = document.createElement("p");
    box.textContent = "New text — click to edit";
    box.style.cssText = "padding:.5rem;margin:1rem auto;max-width:800px;font-size:1rem;line-height:1.6;";
    stageRef.current?.appendChild(box);
    toast.success("Text box added");
  };

  const handleDone = () => {
    if (textToolbar) {
      textToolbar.el.removeAttribute("contenteditable");
      textToolbar.el.style.outline = "";
    }
    const html = stageRef.current?.innerHTML || "";
    onDone(html);
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483600] bg-background flex flex-col">
      {/* Top bar with Done & Cancel */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold gradient-text">Editing template</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">Click any text to edit · Click any image/video to replace</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={insertNewTextBox} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/50">
            <Plus className="h-3.5 w-3.5" /> Text
          </button>
          <button onClick={() => insertImgRef.current?.click()} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/50">
            <ImageIcon className="h-3.5 w-3.5" /> Image
          </button>
          <input ref={insertImgRef} type="file" accept="image/*" className="hidden" onChange={insertNewImage} />
          <button onClick={() => insertVidRef.current?.click()} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/50">
            Video
          </button>
          <input ref={insertVidRef} type="file" accept="video/*" className="hidden" onChange={insertNewVideo} />
          <button onClick={onCancel} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/50">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          <button onClick={handleDone} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium gradient-bg text-primary-foreground hover:opacity-90">
            <Check className="h-3.5 w-3.5" /> Done
          </button>
        </div>
      </div>

      {/* The template stage — like a website */}
      <div className="flex-1 overflow-auto bg-white">
        <div
          ref={stageRef}
          className="template-inline-stage w-full"
          onClick={handleStageClick}
        />
      </div>

      {/* Floating text toolbar */}
      {textToolbar && (
        <div
          className="fixed z-[2147483601] flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-xl"
          style={{ left: textToolbar.left, top: textToolbar.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button onClick={() => exec("bold")} className="p-1.5 rounded hover:bg-muted/50" title="Bold"><Bold className="h-3.5 w-3.5" /></button>
          <button onClick={() => exec("italic")} className="p-1.5 rounded hover:bg-muted/50" title="Italic"><Italic className="h-3.5 w-3.5" /></button>
          <button onClick={() => exec("underline")} className="p-1.5 rounded hover:bg-muted/50" title="Underline"><UnderlineIcon className="h-3.5 w-3.5" /></button>
          <div className="w-px h-5 bg-border mx-1" />
          <Type className="h-3.5 w-3.5 text-muted-foreground ml-1" />
          <select
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="h-7 rounded border border-border bg-background px-1 text-xs"
            defaultValue=""
          >
            <option value="" disabled>Size</option>
            {FONT_SIZES.map((s) => <option key={s} value={s}>{s}px</option>)}
          </select>
          <div className="w-px h-5 bg-border mx-1" />
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="color"
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-8 rounded cursor-pointer bg-transparent border border-border"
            title="Text color"
          />
          <div className="w-px h-5 bg-border mx-1" />
          <button onClick={closeToolbars} className="p-1 rounded hover:bg-muted/50" title="Done"><Check className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Floating media toolbar */}
      {mediaToolbar && (
        <div
          className="fixed z-[2147483601] flex items-center gap-2 rounded-lg border border-border bg-popover p-1.5 shadow-xl"
          style={{ left: mediaToolbar.left, top: mediaToolbar.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground px-1">Media</span>
          <button
            onClick={() => replaceImgRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-muted/50 disabled:opacity-50"
            title="Replace with image"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Image
          </button>
          <input ref={replaceImgRef} type="file" accept="image/*" className="hidden" onChange={onReplaceImg} />
          <button
            onClick={() => replaceVidRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-muted/50 disabled:opacity-50"
            title="Replace with video"
          >
            Video
          </button>
          <input ref={replaceVidRef} type="file" accept="video/*" className="hidden" onChange={onReplaceVid} />
          <button onClick={closeToolbars} className="p-1 rounded hover:bg-muted/50" title="Close"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>,
    document.body,
  );
}
