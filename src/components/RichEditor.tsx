import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { Extension, Node as TiptapNode, mergeAttributes } from "@tiptap/core";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Quote,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Code2,
  Eye,
  Video,
  Upload,
  Loader2,
  X,
  Highlighter,
  Type,
  Maximize2,
  Minimize2,
  PaintBucket,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Trash2,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { uploadWithSupabaseRetry } from "@/lib/supabase-retry";
import { toast } from "sonner";

/* ---------- Custom video node (handles direct mp4 + vimeo iframe) ---------- */
const VideoEmbed = TiptapNode.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: "" },
      provider: { default: "file" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-video-embed]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const { src, provider } = HTMLAttributes;
    if (provider === "vimeo") {
      return [
        "div",
        { "data-video-embed": "true", "data-provider": "vimeo", class: "video-embed" },
        [
          "iframe",
          {
            src,
            frameborder: "0",
            allow: "autoplay; fullscreen; picture-in-picture",
            allowfullscreen: "true",
          },
        ],
      ];
    }
    return [
      "div",
      { "data-video-embed": "true", "data-provider": "file", class: "video-embed" },
      ["video", mergeAttributes({ src, controls: "true", playsinline: "true" })],
    ];
  },
});

const TextLayoutStyle = Extension.create({
  name: "textLayoutStyle",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          width: {
            default: null,
            parseHTML: (element) => element.style.width || null,
            renderHTML: (attributes) =>
              attributes.width
                ? { style: `width: ${attributes.width}; display: inline-block; max-width: 100%;` }
                : {},
          },
          height: {
            default: null,
            parseHTML: (element) => element.style.height || null,
            renderHTML: (attributes) =>
              attributes.height
                ? { style: `height: ${attributes.height}; display: inline-block;` }
                : {},
          },
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) =>
              attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight};` } : {},
          },
          letterSpacing: {
            default: null,
            parseHTML: (element) => element.style.letterSpacing || null,
            renderHTML: (attributes) =>
              attributes.letterSpacing
                ? { style: `letter-spacing: ${attributes.letterSpacing};` }
                : {},
          },
          gradient: {
            default: null,
            parseHTML: (element) => {
              const bi = element.style.backgroundImage;
              const clip = element.style.webkitBackgroundClip || (element.style as any).backgroundClip;
              return bi && /gradient/.test(bi) && /text/.test(clip || "") ? bi : null;
            },
            renderHTML: (attributes) =>
              attributes.gradient
                ? {
                    style: `background-image: ${attributes.gradient}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;`,
                  }
                : {},
          },
          highlightBg: {
            default: null,
            parseHTML: (element) => {
              const bi = element.style.backgroundImage;
              const clip = element.style.webkitBackgroundClip || (element.style as any).backgroundClip;
              if (bi && /gradient/.test(bi) && !/text/.test(clip || "")) return bi;
              return null;
            },
            renderHTML: (attributes) =>
              attributes.highlightBg
                ? {
                    style: `background-image: ${attributes.highlightBg}; padding: 0.05em 0.15em; border-radius: 0.15em;`,
                  }
                : {},
          },
        },
      },
    ];
  },
});

/* ---------- Block style extension: lets paragraphs/headings/blockquote/listItem
   carry an arbitrary inline `style` attribute so we can paint a section
   background across every line in a multi-line selection. ---------- */
const BlockStyle = Extension.create({
  name: "blockStyle",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote", "listItem"],
        attributes: {
          style: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).getAttribute("style") || null,
            renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
          },
        },
      },
    ];
  },
});

/* ---------- Helpers ---------- */
function vimeoEmbed(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m ? `https://player.vimeo.com/video/${m[1]}` : null;
}
function isYoutube(url: string) {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

async function uploadWithRetry(
  bucket: string,
  path: string,
  file: File,
  contentType: string,
  attempts = 3,
) {
  const { error } = await uploadWithSupabaseRetry(bucket, path, file, { cacheControl: "3600", contentType }, Math.max(attempts, 6));
  return error ?? null;
}

/* ---------- Modal ---------- */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl p-5 w-full max-w-md border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted/50" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Fonts ---------- */
const FONTS: { label: string; family: string }[] = [
  // Sans / classic
  { label: "Inter", family: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Arial", family: "Arial, Helvetica, sans-serif" },
  { label: "Arial Black", family: "'Arial Black', Gadget, sans-serif" },
  { label: "Helvetica", family: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", family: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", family: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", family: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Georgia", family: "Georgia, serif" },
  { label: "Times New Roman", family: "'Times New Roman', Times, serif" },
  { label: "Garamond", family: "Garamond, 'Times New Roman', serif" },
  { label: "Palatino", family: "'Palatino Linotype', Palatino, serif" },
  { label: "Courier New", family: "'Courier New', Courier, monospace" },
  { label: "Lucida Console", family: "'Lucida Console', Monaco, monospace" },
  { label: "Monaco", family: "Monaco, Consolas, monospace" },
  { label: "Impact", family: "Impact, Charcoal, sans-serif" },
  { label: "Comic Sans", family: "'Comic Sans MS', cursive" },
  { label: "Brush Script", family: "'Brush Script MT', cursive" },
  { label: "Copperplate", family: "Copperplate, Papyrus, fantasy" },
  { label: "Optima", family: "Optima, Candara, sans-serif" },
  { label: "Gill Sans", family: "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif" },
  // 10 additional standard
  { label: "Roboto", family: "Roboto, system-ui, sans-serif" },
  { label: "Open Sans", family: "'Open Sans', system-ui, sans-serif" },
  { label: "Lato", family: "Lato, system-ui, sans-serif" },
  { label: "Montserrat", family: "Montserrat, system-ui, sans-serif" },
  { label: "Poppins", family: "Poppins, system-ui, sans-serif" },
  { label: "Source Sans Pro", family: "'Source Sans Pro', system-ui, sans-serif" },
  { label: "Nunito", family: "Nunito, system-ui, sans-serif" },
  { label: "Raleway", family: "Raleway, system-ui, sans-serif" },
  { label: "Merriweather", family: "Merriweather, Georgia, serif" },
  { label: "Playfair Display", family: "'Playfair Display', Georgia, serif" },
  // 10 decorative / display
  { label: "Pacifico", family: "Pacifico, 'Brush Script MT', cursive" },
  { label: "Lobster", family: "Lobster, 'Brush Script MT', cursive" },
  { label: "Dancing Script", family: "'Dancing Script', 'Brush Script MT', cursive" },
  { label: "Great Vibes", family: "'Great Vibes', cursive" },
  { label: "Satisfy", family: "Satisfy, cursive" },
  { label: "Caveat", family: "Caveat, 'Comic Sans MS', cursive" },
  { label: "Shadows Into Light", family: "'Shadows Into Light', cursive" },
  { label: "Permanent Marker", family: "'Permanent Marker', Impact, sans-serif" },
  { label: "Bangers", family: "Bangers, Impact, sans-serif" },
  { label: "Press Start 2P", family: "'Press Start 2P', monospace" },
];

const DECORATIVE_FONT_LABELS = new Set([
  "Pacifico","Lobster","Dancing Script","Great Vibes","Satisfy","Caveat",
  "Shadows Into Light","Permanent Marker","Bangers","Press Start 2P",
  "Roboto","Open Sans","Lato","Montserrat","Poppins","Source Sans Pro",
  "Nunito","Raleway","Merriweather","Playfair Display",
]);

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "Roboto:wght@400;700","Open+Sans:wght@400;700","Lato:wght@400;700",
    "Montserrat:wght@400;700","Poppins:wght@400;700","Source+Sans+Pro:wght@400;700",
    "Nunito:wght@400;700","Raleway:wght@400;700","Merriweather:wght@400;700",
    "Playfair+Display:wght@400;700","Pacifico","Lobster","Dancing+Script:wght@400;700",
    "Great+Vibes","Satisfy","Caveat:wght@400;700","Shadows+Into+Light",
    "Permanent+Marker","Bangers","Press+Start+2P",
  ].map((f) => `family=${f}`).join("&") + "&display=swap";

/* ---------- Color picker with transparent swatch + gradients ---------- */
const PRESET_COLORS = [
  "#000000","#ffffff","#ef4444","#f97316","#eab308","#22c55e",
  "#06b6d4","#3b82f6","#8b5cf6","#ec4899","#64748b","#7c2d12",
];
const PRESET_GRADIENTS = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #fccb90, #d57eeb)",
  "linear-gradient(135deg, #e0c3fc, #8ec5fc)",
  "linear-gradient(135deg, #f5576c, #ff6a00)",
  "linear-gradient(135deg, #0c3483, #a2b6df)",
  "linear-gradient(135deg, #c471f5, #fa71cd)",
  "linear-gradient(135deg, #48c6ef, #6f86d6)",
  "linear-gradient(180deg, #0f0c29, #302b63, #24243e)",
  "linear-gradient(180deg, #000000, #434343)",
  "linear-gradient(135deg, #ff9a9e, #fecfef)",
  "linear-gradient(135deg, #ffecd2, #fcb69f)",
  "linear-gradient(135deg, #a1c4fd, #c2e9fb)",
  "linear-gradient(135deg, #d4fc79, #96e6a1)",
];
function ColorPicker({
  icon,
  title,
  onPick,
  anchorRef,
}: {
  icon: React.ReactNode;
  title: string;
  onPick: (color: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"solid" | "gradient" | "mix">("solid");
  const [mixColor1, setMixColor1] = useState("#667eea");
  const [mixColor2, setMixColor2] = useState("#764ba2");
  const [mixAngle, setMixAngle] = useState(135);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    const compute = () => {
      const anchor = anchorRef?.current ?? triggerRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      // Center under the anchor (toolbar) horizontally
      setPos({ left: rect.left + rect.width / 2, top: rect.bottom + 6 });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, anchorRef]);

  const popup = open && pos && typeof document !== "undefined" ? createPortal(
    <>
      <div className="fixed inset-0 z-[2147483600]" onClick={() => setOpen(false)} />
      <div
        className="fixed z-[2147483601] w-64 rounded-md border border-border bg-popover p-2 shadow-xl -translate-x-1/2"
        style={{ left: pos.left, top: pos.top }}
      >
            {/* Tabs */}
            <div className="flex gap-1 mb-2">
              {(["solid", "gradient", "mix"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 text-[10px] font-medium py-1 rounded capitalize",
                    tab === t ? "bg-primary/20 text-primary" : "hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  {t === "mix" ? "Mix" : t}
                </button>
              ))}
            </div>
            {tab === "solid" && (
              <>
                <div className="grid grid-cols-6 gap-1.5">
                  <button
                    type="button"
                    title="Transparent"
                    onClick={() => { onPick("transparent"); setOpen(false); }}
                    className="h-6 w-6 rounded border border-border bg-white relative overflow-hidden"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
                      backgroundSize: "8px 8px",
                      backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
                    }}
                  />
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { onPick(c); setOpen(false); }}
                      className="h-6 w-6 rounded border border-border"
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  Custom
                  <input
                    type="color"
                    onChange={(e) => { onPick(e.target.value); setOpen(false); }}
                    className="h-6 w-10 rounded cursor-pointer bg-transparent border border-border"
                  />
                </label>
              </>
            )}
            {tab === "gradient" && (
              <div className="grid grid-cols-6 gap-1.5">
                {PRESET_GRADIENTS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { onPick(g); setOpen(false); }}
                    className="h-6 w-6 rounded border border-border"
                    style={{ background: g }}
                    title={g}
                  />
                ))}
              </div>
            )}
            {tab === "mix" && (
              <div className="space-y-2">
                <div className="h-8 w-full rounded border border-border" style={{ background: `linear-gradient(${mixAngle}deg, ${mixColor1}, ${mixColor2})` }} />
                <div className="flex items-center gap-2">
                  <input type="color" value={mixColor1} onChange={(e) => setMixColor1(e.target.value)} className="h-6 w-8 rounded cursor-pointer bg-transparent border border-border" />
                  <input type="color" value={mixColor2} onChange={(e) => setMixColor2(e.target.value)} className="h-6 w-8 rounded cursor-pointer bg-transparent border border-border" />
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground flex-1">
                    <input type="range" min={0} max={360} value={mixAngle} onChange={(e) => setMixAngle(Number(e.target.value))} className="flex-1 h-1" />
                    {mixAngle}°
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => { onPick(`linear-gradient(${mixAngle}deg, ${mixColor1}, ${mixColor2})`); setOpen(false); }}
                  className="w-full text-xs py-1 rounded bg-primary/20 text-primary hover:bg-primary/30"
                >
                  Apply gradient
                </button>
              </div>
            )}
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        title={title}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-muted/50 border border-transparent"
      >
        {icon}
        <span className="text-[10px] text-muted-foreground">▾</span>
      </button>
      {popup}
    </div>
  );
}

/* ---------- Wrapper helpers to persist page background in content_html ---------- */
const WRAPPER_RE = /^<div data-rich-wrapper="true"[^>]*style="([^"]*)"[^>]*>([\s\S]*)<\/div>$/;

function unwrapContent(html: string): { innerHtml: string; bg: string } {
  const m = html.match(WRAPPER_RE);
  if (m) {
    const stylePart = m[1];
    const bgMatch = stylePart.match(/background\s*:\s*([^;]+)/);
    return { innerHtml: m[2], bg: bgMatch ? bgMatch[1].trim() : "#ffffff" };
  }
  return { innerHtml: html, bg: "#ffffff" };
}

function wrapContent(innerHtml: string, bg: string): string {
  return `<div data-rich-wrapper="true" style="background:${bg};padding:1.5rem 2rem;">${innerHtml}</div>`;
}

/* Extract <style> blocks from HTML so TipTap doesn't strip them, and scope
   each rule with a prefix so it cannot leak into the surrounding site UI. */
function extractStyleBlocks(html: string): { styles: string[]; cleaned: string } {
  const styles: string[] = [];
  const cleaned = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => {
    styles.push(String(css));
    return "";
  });
  return { styles, cleaned };
}

/** Scope a CSS string so every selector is prefixed with `scope`. Skips @rules. */
function scopeCss(css: string, scope: string): string {
  // Remove block comments
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  let i = 0;
  while (i < noComments.length) {
    // Pass through @-rules untouched (best-effort: take the next {...} balanced or ;)
    if (noComments[i] === "@") {
      const semi = noComments.indexOf(";", i);
      const brace = noComments.indexOf("{", i);
      if (brace === -1 || (semi !== -1 && semi < brace)) {
        out += noComments.slice(i, semi + 1);
        i = semi + 1;
        continue;
      }
      // balance braces
      let depth = 0;
      let j = brace;
      for (; j < noComments.length; j++) {
        if (noComments[j] === "{") depth++;
        else if (noComments[j] === "}") {
          depth--;
          if (depth === 0) { j++; break; }
        }
      }
      const atRule = noComments.slice(i, brace + 1);
      const inner = noComments.slice(brace + 1, j - 1);
      out += atRule + scopeCss(inner, scope) + "}";
      i = j;
      continue;
    }
    const brace = noComments.indexOf("{", i);
    if (brace === -1) break;
    const close = noComments.indexOf("}", brace);
    if (close === -1) break;
    const selectors = noComments.slice(i, brace);
    const body = noComments.slice(brace + 1, close);
    const scoped = selectors
      .split(",")
      .map((s) => {
        const t = s.trim();
        if (!t) return "";
        if (t === "html" || t === "body" || t === "*") return scope;
        return `${scope} ${t}`;
      })
      .filter(Boolean)
      .join(", ");
    out += `${scoped}{${body}}`;
    i = close + 1;
  }
  return out;
}

type Props = { value: string; onChange: (html: string) => void };

type MediaSelection = {
  el: HTMLElement;
  width: string;
  height: string;
  radius: string;
  rotate: string;
};

export function RichEditor({ value, onChange }: Props) {
  const { user } = useAuth();
  const initParsed = unwrapContent(value);
  const [showHtml, setShowHtml] = useState(false);
  const [htmlBuffer, setHtmlBuffer] = useState(initParsed.innerHtml);
  const [imgModal, setImgModal] = useState<null | "menu" | "link" | "upload">(null);
  const [vidModal, setVidModal] = useState<null | "menu" | "link" | "upload">(null);
  const [linkModal, setLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState("");
  const [pageBg, setPageBg] = useState<string>(initParsed.bg);
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);
  // CSS extracted from <style> blocks in the HTML view, scoped to this editor instance
  const scopeIdRef = useRef(`rich-${Math.random().toString(36).slice(2, 9)}`);
  const [scopedStyles, setScopedStyles] = useState<string[]>(() => {
    const { styles } = extractStyleBlocks(initParsed.innerHtml);
    return styles;
  });

  // Selection style inputs (committed-on-Enter)
  const [selStyle, setSelStyle] = useState({
    width: "",
    height: "",
    lineHeight: "",
    letterSpacing: "",
  });
  // Stored ProseMirror selection captured BEFORE the user clicks into a style input
  const savedRangeRef = useRef<{ from: number; to: number } | null>(null);

  // Debounce parent onChange so each keystroke (esp. delete/backspace) doesn't
  // trigger a re-render of the lazily-loaded editor — keeps typing & deleting smooth.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const pageBgRef = useRef(pageBg);
  useEffect(() => { pageBgRef.current = pageBg; }, [pageBg]);
  const debounceRef = useRef<number | null>(null);
  const scheduleParentChange = useCallback((html: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onChangeRef.current(wrapContent(html, pageBgRef.current));
    }, 220);
  }, []);
  useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    },
    [],
  );

  // Floating toolbar for selected image / video
  const [mediaSel, setMediaSel] = useState<MediaSelection | null>(null);
  const mediaSelRef = useRef<MediaSelection | null>(null);
  useEffect(() => {
    mediaSelRef.current = mediaSel;
  }, [mediaSel]);

  const fileImgRef = useRef<HTMLInputElement>(null);
  const fileVidRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit, // includes heading 1-6, lists, link, underline, blockquote, code, history…
      TextStyle,
      TextLayoutStyle,
      BlockStyle,
      Color,
      FontFamily.configure({ types: ["textStyle"] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph", "image"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              parseHTML: (el: HTMLElement) => el.getAttribute("style") || null,
              renderHTML: (attributes: Record<string, any>) =>
                attributes.style ? { style: attributes.style } : {},
            },
          };
        },
      }).configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "rich-image" },
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        HTMLAttributes: { class: "video-embed-youtube" },
      }),
      VideoEmbed,
    ] as any,
    content: initParsed.innerHtml,
    editorProps: {
      attributes: {
        class:
          "prose max-w-none min-h-[300px] focus:outline-none p-4 rich-editor-content rich-editor-light",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setHtmlBuffer(html);
      scheduleParentChange(html);
    },
    onSelectionUpdate: () => readSelectionStyle(),
    immediatelyRender: false,
  });

  useEffect(() => {
    const { innerHtml, bg } = unwrapContent(value);
    const wrappedCurrent = wrapContent(htmlBuffer, pageBg);
    if (editor && value !== wrappedCurrent && !showHtml) {
      editor.commands.setContent(innerHtml || "", { emitUpdate: false });
      setHtmlBuffer(innerHtml || "");
      setPageBg(bg);
      pageBgRef.current = bg;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // Lock body scroll while fullscreen so the standalone editor truly stands alone
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (fullscreen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [fullscreen]);

  // Inject scoped <style> blocks so internal CSS from HTML view also applies in Visual view.
  // Each rule is prefixed with `.${scopeId}` so it cannot leak into the surrounding site UI.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = `rich-editor-scoped-${scopeIdRef.current}`;
    let tag = document.getElementById(id) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = id;
      document.head.appendChild(tag);
    }
    const scope = `.${scopeIdRef.current}`;
    tag.textContent = scopedStyles.map((c) => scopeCss(c, scope)).join("\n");
    return () => {
      // keep on unmount? remove to avoid leaks
      tag?.remove();
    };
  }, [scopedStyles]);

  // Inject Google Fonts stylesheet once so decorative fonts render in the picker + editor
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "rich-editor-google-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS_HREF;
    document.head.appendChild(link);
  }, []);

  const readSelectionStyle = useCallback(() => {
    if (typeof window === "undefined") return;
    const attrs = editor?.getAttributes("textStyle") || {};
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setSelStyle({
        width: attrs.width || "",
        height: attrs.height || "",
        lineHeight: attrs.lineHeight || "",
        letterSpacing: attrs.letterSpacing || "",
      });
      return;
    }
    let node: Node | null = sel.anchorNode;
    while (node && node.nodeType !== 1) node = node.parentNode;
    if (!node) return;
    const cs = window.getComputedStyle(node as Element);
    setSelStyle({
      width: attrs.width || (node as HTMLElement).style?.width || "",
      height: attrs.height || (node as HTMLElement).style?.height || "",
      lineHeight:
        attrs.lineHeight || (node as HTMLElement).style?.lineHeight || cs.lineHeight || "",
      letterSpacing:
        attrs.letterSpacing || (node as HTMLElement).style?.letterSpacing || cs.letterSpacing || "",
    });
  }, [editor]);

  // Continuous nudge ref + cleanup must be before the early return to keep hook order stable
  const nudgeIntervalRef = useRef<number | null>(null);
  useEffect(() => () => { if (nudgeIntervalRef.current) window.clearInterval(nudgeIntervalRef.current); }, []);

  if (!editor) return <div className="glass rounded-xl h-80 animate-pulse" />;

  const uploadToBucket = async (file: File, kind: "image" | "video") => {
    if (!user) {
      toast.error("Sign in required");
      return null;
    }
    const max = kind === "image" ? 10 : 100;
    if (file.size > max * 1024 * 1024) {
      toast.error(`Max ${max}MB`);
      return null;
    }
    const ext = file.name.split(".").pop() || (kind === "image" ? "png" : "mp4");
    const path = `${user.id}/${kind}/${Date.now()}.${ext}`;
    const err = await uploadWithRetry("research-media", path, file, file.type);
    if (err) {
      toast.error(err.message || "Upload failed");
      return null;
    }
    const { data } = supabase.storage.from("research-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const insertImage = (url: string) => {
    editor.chain().focus().setImage({ src: url }).run();
    setImgModal(null);
    setLinkUrl("");
  };

  const insertVideo = (url: string, source: "file" | "link") => {
    if (source === "link") {
      if (isYoutube(url)) {
        (editor.chain().focus() as any)
          .setYoutubeVideo({ src: url, width: 640, height: 360 })
          .run();
      } else {
        const vimeo = vimeoEmbed(url);
        if (vimeo)
          editor
            .chain()
            .focus()
            .insertContent({ type: "videoEmbed", attrs: { src: vimeo, provider: "vimeo" } })
            .run();
        else
          editor
            .chain()
            .focus()
            .insertContent({ type: "videoEmbed", attrs: { src: url, provider: "file" } })
            .run();
      }
    } else {
      editor
        .chain()
        .focus()
        .insertContent({ type: "videoEmbed", attrs: { src: url, provider: "file" } })
        .run();
    }
    setVidModal(null);
    setLinkUrl("");
  };

  const onImgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const url = await uploadToBucket(f, "image");
    setUploading(false);
    if (url) insertImage(url);
    e.target.value = "";
  };
  const onVidFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const url = await uploadToBucket(f, "video");
    setUploading(false);
    if (url) insertVideo(url, "file");
    e.target.value = "";
  };

  const openLinkModal = () => {
    const sel = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(sel.from, sel.to, " ");
    setLinkLabel(selectedText || "");
    setLinkUrl("");
    setLinkModal(true);
  };

  const submitLink = () => {
    if (!linkUrl) return;
    const label = linkLabel.trim() || linkUrl;
    // Replace selection with: <a href=url>label</a> then on a new line print the url under it
    const sel = editor.state.selection;
    const chain = editor.chain().focus();
    if (sel.empty) {
      chain
        .insertContent(
          `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${label}</a><br><span class="link-url-below">${linkUrl}</span>`,
        )
        .run();
    } else {
      chain
        .deleteSelection()
        .insertContent(
          `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${label}</a><br><span class="link-url-below">${linkUrl}</span>`,
        )
        .run();
    }
    setLinkModal(false);
    setLinkUrl("");
    setLinkLabel("");
  };

  const normalizeStyleValue = (
    prop: "lineHeight" | "letterSpacing" | "width" | "height",
    raw: string,
  ) => {
    const value = raw.trim();
    if (!value) return "";
    if (
      (prop === "width" || prop === "height" || prop === "letterSpacing") &&
      /^-?\d+(\.\d+)?$/.test(value)
    )
      return `${value}px`;
    return value;
  };

  const chooseFont = (font: (typeof FONTS)[number]) => {
    setSelectedFont(font);
    setFontMenuOpen(false);
    editor.chain().focus().setFontFamily(font.family).run();
  };

  // Capture current editor selection so it survives focusing the W/H/Line/Spacing inputs.
  const captureSelection = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    savedRangeRef.current = { from, to };
  };

  // Commit a style value to the saved editor selection. Called only on Enter or blur.
  const commitInlineStyle = (
    prop: "lineHeight" | "letterSpacing" | "width" | "height",
    val: string,
  ) => {
    const normalized = normalizeStyleValue(prop, val);
    const range = savedRangeRef.current;
    const chain = editor.chain();
    if (range && range.from !== range.to) {
      chain.setTextSelection(range);
    } else {
      chain.focus();
    }
    const attrs = { [prop]: normalized || null } as Record<string, string | null>;
    chain.setMark("textStyle", attrs).removeEmptyTextStyle().run();
    const html = editor.getHTML();
    setHtmlBuffer(html);
    scheduleParentChange(html);
  };

  // Apply a background color across every block (paragraph/heading/li) touched
  // by the current selection — so highlighting from line 1 to line N tints
  // every line, not just the inline run.
  const applySectionBackground = (color: string) => {
    if (!editor) return;
    const { state } = editor;
    const { from, to } = state.selection;
    const tr = state.tr;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (
        node.type.name === "paragraph" ||
        node.type.name === "heading" ||
        node.type.name === "blockquote" ||
        node.type.name === "listItem"
      ) {
        const existing = (node.attrs as any)?.style || "";
        const cleaned = existing.replace(/background(-color|-image)?\s*:\s*[^;]+;?/gi, "").trim();
        const isGradient = /gradient/i.test(color);
        const bgDecl = isGradient ? `background-image:${color}` : `background-color:${color}`;
        const nextStyle = `${cleaned}${cleaned && !cleaned.endsWith(";") ? ";" : ""}${bgDecl};`;
        try {
          tr.setNodeAttribute(pos, "style" as any, nextStyle);
        } catch {
          // node type might not allow a style attr — fall back to inline highlight
        }
        return false;
      }
      return true;
    });
    if (tr.docChanged) {
      editor.view.dispatch(tr);
      const html = editor.getHTML();
      setHtmlBuffer(html);
      scheduleParentChange(html);
    } else {
      // Fallback: inline highlight covers the run
      (editor.chain().focus() as any).setHighlight({ color }).run();
    }
  };

  // Open the floating media toolbar (replacing the formatting toolbar)
  // when an image / video / iframe is hovered or clicked.
  const openMediaToolbar = (media: HTMLElement) => {
    const inline = media.style;
    const cs = window.getComputedStyle(media);
    const parent = media.parentElement;
    const parentW = parent ? parent.getBoundingClientRect().width || 1 : 1;
    const parentH = parent ? parent.getBoundingClientRect().height || 1 : 1;
    const rect = media.getBoundingClientRect();
    const widthPct = inline.width && inline.width.endsWith("%")
      ? inline.width
      : `${Math.round((rect.width / parentW) * 1000) / 10}%`;
    const heightPct = inline.height && inline.height.endsWith("%")
      ? inline.height
      : `${Math.round((rect.height / parentH) * 1000) / 10}%`;
    const nextSelection = {
      el: media,
      width: widthPct,
      height: heightPct,
      radius: inline.borderRadius || cs.borderRadius || "0%",
      rotate: (inline.transform.match(/rotate\(([-\d.]+)deg\)/) || [, "0"])[1] + "deg",
    };
    mediaSelRef.current = nextSelection;
    setMediaSel(nextSelection);
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const media = target.closest(
      "img, video, iframe, .video-embed, [data-youtube-video]",
    ) as HTMLElement | null;
    if (media) openMediaToolbar(media);
  };

  const handleEditorMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mediaSel) return;
    const target = e.target as HTMLElement;
    const media = target.closest(
      "img, video, iframe, .video-embed, [data-youtube-video]",
    ) as HTMLElement | null;
    if (media) openMediaToolbar(media);
  };

  const deleteSelectedMedia = () => {
    if (!mediaSel || !editor) return;
    const el = mediaSel.el;
    // Use TipTap to find the node at the DOM position and delete it
    const pos = (editor.view as any).posAtDOM(el, 0);
    if (typeof pos === "number" && pos >= 0) {
      const $pos = editor.state.doc.resolve(pos);
      // walk up to find an ancestor node we can delete
      const tr = editor.state.tr;
      const node = editor.state.doc.nodeAt(pos);
      if (node) {
        tr.delete(pos, pos + node.nodeSize);
        editor.view.dispatch(tr);
      } else {
        el.remove();
        const html = editor.getHTML();
        setHtmlBuffer(html);
        scheduleParentChange(html);
      }
    } else {
      el.remove();
    }
    setMediaSel(null);
  };

  const resolveMediaElement = (el: HTMLElement) => {
    if (!editor) return { el, pos: null as number | null };
    const isMediaNode = (pos: number) => {
      const node = editor.state.doc.nodeAt(pos);
      return Boolean(node && ["image", "videoEmbed", "youtube"].includes(node.type.name));
    };
    const getPos = (node: HTMLElement) => {
      try {
        const pos = (editor.view as any).posAtDOM(node, 0);
        return typeof pos === "number" && pos >= 0 && isMediaNode(pos) ? pos : null;
      } catch {
        return null;
      }
    };
    let pos = getPos(el);
    if (pos !== null) return { el, pos };
    const src = el.getAttribute("src") || el.querySelector("img, video, iframe")?.getAttribute("src");
    if (src) {
      editor.state.doc.descendants((node, nodePos) => {
        if (pos !== null) return false;
        if (["image", "videoEmbed", "youtube"].includes(node.type.name) && node.attrs.src === src) pos = nodePos;
        return true;
      });
      if (pos !== null) {
        const nodeDOM = editor.view.nodeDOM(pos);
        if (nodeDOM instanceof HTMLElement) return { el: nodeDOM, pos };
        if (nodeDOM && (nodeDOM as any).firstChild instanceof HTMLElement) return { el: (nodeDOM as any).firstChild as HTMLElement, pos };
        return { el, pos };
      }
    }
    const fresh = Array.from(editor.view.dom.querySelectorAll<HTMLElement>("img, video, iframe, .video-embed, [data-youtube-video]")).find((candidate) => {
      const candidateSrc = candidate.getAttribute("src") || candidate.querySelector("img, video, iframe")?.getAttribute("src");
      return Boolean(src && candidateSrc === src);
    });
    if (fresh) {
      pos = getPos(fresh);
      if (pos !== null) return { el: fresh, pos };
    }
    return { el, pos: null as number | null };
  };

  /** Sync the DOM element's current inline style string into the Tiptap node attribute
   *  so that editor.getHTML() serialises it correctly.
   *  Returns the (possibly new) DOM element after the transaction re-renders. */
  const syncStyleToNode = (el: HTMLElement): HTMLElement => {
    if (!editor) return el;
    const resolved = resolveMediaElement(el);
    el = resolved.el;
    const styleStr = el.getAttribute("style") || null;
    const pos = resolved.pos;
    if (pos !== null) {
      const node = editor.state.doc.nodeAt(pos);
      if (node) {
        const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          style: styleStr,
        });
        editor.view.dispatch(tr);
        // The dispatch re-renders the node, so grab the fresh DOM element
        const newNode = editor.view.nodeDOM(pos);
        if (newNode instanceof HTMLElement) {
          el = newNode;
        } else if (newNode && (newNode as any).firstChild instanceof HTMLElement) {
          el = (newNode as any).firstChild as HTMLElement;
        }
      }
    }
    const html = editor.getHTML();
    setHtmlBuffer(html);
    scheduleParentChange(html);
    return el;
  };

  const updateMediaStyle = (
    patch: Partial<{ width: string; height: string; radius: string; rotate: string }>,
  ) => {
    const normalizeSizeValue = (value: string) => /^\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}%` : value;
    setMediaSel((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      let el = resolveMediaElement(next.el).el;
      if (patch.width !== undefined) el.style.width = normalizeSizeValue(patch.width);
      if (patch.height !== undefined) el.style.height = normalizeSizeValue(patch.height);
      if (patch.radius !== undefined) el.style.borderRadius = normalizeSizeValue(patch.radius);
      if (patch.rotate !== undefined) {
        const others = el.style.transform.replace(/rotate\([^)]+\)/g, "").trim();
        const deg = patch.rotate.endsWith("deg") ? patch.rotate : `${patch.rotate}deg`;
        el.style.transform = `${others} rotate(${deg})`.trim();
      }
      const freshEl = syncStyleToNode(el);
      const freshSel = { ...next, el: freshEl };
      mediaSelRef.current = freshSel;
      return freshSel;
    });
  };

  const nudgeMedia = (dir: "left" | "right" | "up" | "down") => {
    const current = mediaSelRef.current;
    if (!current) return;
    const el = resolveMediaElement(current.el).el;
    if (el !== current.el) mediaSelRef.current = { ...current, el };
    // Ensure element is absolutely positioned inside a relative parent
    if (el.style.position !== "absolute") {
      el.style.position = "absolute";
      const parent = el.parentElement;
      if (parent && window.getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }
    }
    const curLeft = parseFloat(el.style.left) || 0;
    const curTop = parseFloat(el.style.top) || 0;
    const step = 0.5; // 0.5% step
    const fmt = (n: number) => `${Math.round(n * 10) / 10}%`;
    if (dir === "left") el.style.left = fmt(curLeft - step);
    if (dir === "right") el.style.left = fmt(curLeft + step);
    if (dir === "up") el.style.top = fmt(curTop - step);
    if (dir === "down") el.style.top = fmt(curTop + step);
    // Don't sync to node during continuous nudge — sync on stop instead
    if (editor) {
      const html = editor.getHTML();
      setHtmlBuffer(html);
      scheduleParentChange(html);
    }
  };

  const startNudge = (dir: "left" | "right" | "up" | "down") => {
    nudgeMedia(dir);
    nudgeIntervalRef.current = window.setInterval(() => nudgeMedia(dir), 80);
  };
  const stopNudge = () => {
    if (nudgeIntervalRef.current) {
      window.clearInterval(nudgeIntervalRef.current);
      nudgeIntervalRef.current = null;
    }
    // Sync final position to Tiptap node so getHTML() includes it
    if (mediaSelRef.current) {
      const freshEl = syncStyleToNode(mediaSelRef.current.el);
      setMediaSel((prev) => {
        const next = prev ? { ...prev, el: freshEl } : prev;
        mediaSelRef.current = next;
        return next;
      });
    }
  };

  const Btn = ({
    on,
    active,
    children,
    label,
    disabled,
  }: {
    on: () => void;
    active?: boolean;
    children: React.ReactNode;
    label: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "p-2 rounded-md hover:bg-muted/50 transition disabled:opacity-40",
        active && "bg-primary/20 text-primary",
      )}
    >
      {children}
    </button>
  );

  const editorTree = (
    <div
      className={cn(
        "glass rounded-xl overflow-hidden border border-border",
        fullscreen &&
          "fixed inset-0 z-[2147483600] rounded-none flex flex-col bg-background border-0",
      )}
    >
      {/* Top action bar — preview, html toggle, fullscreen all on one horizontal line */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-background">
        <span className="text-xs text-muted-foreground font-medium">Content editor</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const win = window.open("", "_blank");
              if (!win) { toast.error("Popup blocked"); return; }
              win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Preview</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${GOOGLE_FONTS_HREF}"><style>body{margin:0;padding:2rem;background:${pageBg};color:#111827;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.6}img,video,iframe{max-width:100%;height:auto}.video-embed{position:relative;aspect-ratio:16/9;width:100%;margin:1rem 0;background:#000;border-radius:.5rem;overflow:hidden}.video-embed iframe,.video-embed video{position:absolute;inset:0;width:100%;height:100%;border:0}h1{font-size:2em;font-weight:700;margin:.6em 0 .4em}h2{font-size:1.5em;font-weight:700;margin:.6em 0 .4em}h3{font-size:1.25em;font-weight:600;margin:.6em 0 .4em}ul{list-style:disc;padding-left:1.5rem}ol{list-style:decimal;padding-left:1.5rem}a{color:#2563eb;text-decoration:underline}.link-url-below{display:inline-block;font-size:.8em;color:#6b7280;word-break:break-all}main{max-width:900px;margin:0 auto}</style></head><body><main>${htmlBuffer || ""}</main></body></html>`);
              win.document.close();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/50 transition"
            title="Open content-only preview in a new tab"
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button
            type="button"
            onClick={() => {
              if (showHtml) {
                // Switching HTML -> Visual: extract <style> blocks (so TipTap doesn't drop them)
                // and feed only the cleaned body to the editor; styles are kept scoped & applied via effect.
                const { styles, cleaned } = extractStyleBlocks(htmlBuffer || "");
                setScopedStyles(styles);
                editor.commands.setContent(cleaned, { emitUpdate: true });
              }
              setShowHtml((s) => !s);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border transition",
              showHtml ? "bg-primary/20 text-primary" : "hover:bg-muted/50",
            )}
            title="Toggle HTML source"
          >
            {showHtml ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Visual
              </>
            ) : (
              <>
                <Code2 className="h-3.5 w-3.5" /> HTML
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/50 transition"
          >
            {fullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" /> Minimize
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" /> Full page
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div ref={toolbarRef} className="relative flex flex-wrap items-center gap-1 p-2 border-b border-border bg-background">
        <div
          className={cn(
            "flex flex-wrap items-center gap-1 w-full",
            mediaSel && !showHtml && "invisible pointer-events-none",
          )}
        >
        {!showHtml && (
          <>
            <Btn
              label="Bold"
              on={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
            >
              <Bold className="h-4 w-4" />
            </Btn>
            <Btn
              label="Italic"
              on={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
            >
              <Italic className="h-4 w-4" />
            </Btn>
            <Btn
              label="Underline"
              on={() => (editor.chain().focus() as any).toggleUnderline().run()}
              active={editor.isActive("underline")}
            >
              <UnderlineIcon className="h-4 w-4" />
            </Btn>
            <div className="w-px h-5 bg-border mx-1" />
            <Btn
              label="Heading 1"
              on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              active={editor.isActive("heading", { level: 1 })}
            >
              <Heading1 className="h-4 w-4" />
            </Btn>
            <Btn
              label="Heading 2"
              on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive("heading", { level: 2 })}
            >
              <Heading2 className="h-4 w-4" />
            </Btn>
            <Btn
              label="Heading 3"
              on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive("heading", { level: 3 })}
            >
              <Heading3 className="h-4 w-4" />
            </Btn>
            <Btn
              label="Bullet list"
              on={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive("bulletList")}
            >
              <List className="h-4 w-4" />
            </Btn>
            <Btn
              label="Numbered list"
              on={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive("orderedList")}
            >
              <ListOrdered className="h-4 w-4" />
            </Btn>
            <Btn
              label="Quote"
              on={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive("blockquote")}
            >
              <Quote className="h-4 w-4" />
            </Btn>

            <div className="w-px h-5 bg-border mx-1" />
            <Btn
              label="Align left"
              on={() => (editor.chain().focus() as any).setTextAlign("left").run()}
              active={editor.isActive({ textAlign: "left" })}
            >
              <AlignLeft className="h-4 w-4" />
            </Btn>
            <Btn
              label="Align center"
              on={() => (editor.chain().focus() as any).setTextAlign("center").run()}
              active={editor.isActive({ textAlign: "center" })}
            >
              <AlignCenter className="h-4 w-4" />
            </Btn>
            <Btn
              label="Align right"
              on={() => (editor.chain().focus() as any).setTextAlign("right").run()}
              active={editor.isActive({ textAlign: "right" })}
            >
              <AlignRight className="h-4 w-4" />
            </Btn>
            <Btn
              label="Justify"
              on={() => (editor.chain().focus() as any).setTextAlign("justify").run()}
              active={editor.isActive({ textAlign: "justify" })}
            >
              <AlignJustify className="h-4 w-4" />
            </Btn>

            <div className="w-px h-5 bg-border mx-1" />
            {/* Font family — custom 40% width menu so every option shows its own style */}
            <div className="relative inline-flex w-[40%] min-w-0 max-w-[40%] basis-[40%] items-center gap-1">
              <Type className="h-4 w-4 text-muted-foreground shrink-0" />
              <button
                type="button"
                aria-label="Font"
                onClick={() => setFontMenuOpen((open) => !open)}
                className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-background px-3 text-left text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <span className="truncate" style={{ fontFamily: selectedFont.family }}>
                  {selectedFont.label}
                </span>
                <span className="text-muted-foreground">⌄</span>
              </button>
              {fontMenuOpen && (
                <div className="absolute left-5 right-0 top-10 z-[2147483601] flex max-h-80 flex-col rounded-md border border-border bg-popover text-popover-foreground shadow-xl">
                  <div className="sticky top-0 z-10 border-b border-border bg-popover p-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={fontSearch}
                      onChange={(e) => setFontSearch(e.target.value)}
                      placeholder="Search fonts…"
                      className="w-full rounded-sm border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="overflow-y-auto p-1">
                    {FONTS.filter((f) =>
                      f.label.toLowerCase().includes(fontSearch.trim().toLowerCase()),
                    ).map((font) => (
                      <button
                        key={font.label}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          chooseFont(font);
                          setFontSearch("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                          selectedFont.label === font.label && "bg-primary/20 text-primary",
                          DECORATIVE_FONT_LABELS.has(font.label) && "text-base",
                        )}
                        style={{ fontFamily: font.family }}
                      >
                        <span>{font.label}</span>
                        <span className="text-[10px] opacity-70">Aa Bb</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Text color */}
            <ColorPicker
              anchorRef={toolbarRef}
              icon={<span className="text-foreground font-semibold text-sm">A</span>}
              title="Text color"
              onPick={(c) => {
                if (c === "transparent") {
                  (editor.chain().focus() as any).unsetColor().run();
                  (editor.chain().focus() as any).setMark("textStyle", { gradient: null }).removeEmptyTextStyle().run();
                } else if (c.startsWith("linear-gradient") || c.startsWith("radial-gradient")) {
                  // Apply gradient text via textStyle.gradient -> background-clip:text
                  (editor.chain().focus() as any).unsetColor().run();
                  (editor.chain().focus() as any).setMark("textStyle", { gradient: c }).run();
                } else {
                  (editor.chain().focus() as any).setMark("textStyle", { gradient: null }).run();
                  editor.chain().focus().setColor(c).run();
                }
              }}
            />

            {/* Highlight color */}
            <ColorPicker
              anchorRef={toolbarRef}
              icon={<Highlighter className="h-4 w-4 text-muted-foreground" />}
              title="Highlight"
              onPick={(c) => {
                if (c === "transparent") {
                  (editor.chain().focus() as any).unsetHighlight().run();
                  (editor.chain().focus() as any).setMark("textStyle", { highlightBg: null }).removeEmptyTextStyle().run();
                } else if (c.startsWith("linear-gradient") || c.startsWith("radial-gradient")) {
                  (editor.chain().focus() as any).unsetHighlight().run();
                  (editor.chain().focus() as any).setMark("textStyle", { highlightBg: c }).run();
                } else {
                  (editor.chain().focus() as any).setMark("textStyle", { highlightBg: null }).run();
                  (editor.chain().focus() as any).setHighlight({ color: c }).run();
                }
              }}
            />

            {/* Section background color — colors every line in the highlighted range */}
            <ColorPicker
              anchorRef={toolbarRef}
              icon={<PaintBucket className="h-4 w-4 text-muted-foreground" />}
              title="Section background (colors every highlighted line from start to end)"
              onPick={(c) => applySectionBackground(c)}
            />

            {/* Page background — recolors the whole editor surface */}
            <ColorPicker
              anchorRef={toolbarRef}
              icon={<Square className="h-4 w-4 text-muted-foreground" fill="currentColor" />}
              title="Page background"
              onPick={(c) => { setPageBg(c); pageBgRef.current = c; if (editor) { const html = editor.getHTML(); setHtmlBuffer(html); scheduleParentChange(html); } }}
            />

            <div className="w-px h-5 bg-border mx-1" />
            <Btn label="Insert link" on={openLinkModal}>
              <LinkIcon className="h-4 w-4" />
            </Btn>
            <Btn label="Insert image" on={() => setImgModal("menu")}>
              <ImageIcon className="h-4 w-4" />
            </Btn>
            <Btn label="Insert video" on={() => setVidModal("menu")}>
              <Video className="h-4 w-4" />
            </Btn>

            <div className="w-px h-5 bg-border mx-1" />
            {(
              [
                { key: "width", label: "W", placeholder: "auto" },
                { key: "height", label: "H", placeholder: "auto" },
                { key: "lineHeight", label: "Line", placeholder: "1.5" },
                { key: "letterSpacing", label: "Spacing", placeholder: "0px" },
              ] as const
            ).map((field) => (
              <label key={field.key} className="inline-flex items-center gap-1 text-xs">
                {field.label}
                <input
                  value={selStyle[field.key]}
                  onFocus={captureSelection}
                  onChange={(e) =>
                    setSelStyle((s) => ({ ...s, [field.key]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitInlineStyle(field.key, (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={(e) => commitInlineStyle(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-16 bg-background border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            ))}

            <div className="w-px h-5 bg-border mx-1" />
            <Btn label="Undo" on={() => editor.chain().focus().undo().run()}>
              <Undo className="h-4 w-4" />
            </Btn>
            <Btn label="Redo" on={() => editor.chain().focus().redo().run()}>
              <Redo className="h-4 w-4" />
            </Btn>
          </>
        )}
        </div>

        {/* Media toolbar — absolutely overlays the formatting toolbar when an image/video is hovered or selected */}
        {!showHtml && mediaSel && (
          <div
            className="absolute inset-0 z-20 flex flex-wrap items-center gap-2 px-2 py-2 bg-background"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs font-medium text-muted-foreground">Media:</span>
            {(
              [
                { key: "width", label: "W" },
                { key: "height", label: "H" },
                { key: "radius", label: "Radius" },
              ] as const
            ).map((f) => (
              <label key={f.key} className="inline-flex items-center gap-1 text-xs">
                {f.label}
                <input
                  value={mediaSel[f.key]}
                  onChange={(e) => {
                    const v = e.target.value;
                    const patch: any = {};
                    patch[f.key] = v;
                    updateMediaStyle(patch);
                  }}
                  className="w-20 rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            ))}
            <div className="w-px h-5 bg-border mx-1" />
            {(["left", "up", "down", "right"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                title={`Move ${dir}`}
                onMouseDown={() => startNudge(dir)}
                onMouseUp={stopNudge}
                onMouseLeave={stopNudge}
                onTouchStart={() => startNudge(dir)}
                onTouchEnd={stopNudge}
                className="p-1 rounded hover:bg-muted/50"
              >
                {dir === "left" && <ArrowLeft className="h-4 w-4" />}
                {dir === "up" && <ArrowUp className="h-4 w-4" />}
                {dir === "down" && <ArrowDown className="h-4 w-4" />}
                {dir === "right" && <ArrowRight className="h-4 w-4" />}
              </button>
            ))}
            <button
              type="button"
              title="Rotate 15°"
              onClick={() => {
                const cur = parseFloat(mediaSel.rotate) || 0;
                updateMediaStyle({ rotate: `${cur + 15}deg` });
              }}
              className="p-1 rounded hover:bg-muted/50"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Delete"
              onClick={deleteSelectedMedia}
              className="p-1 rounded hover:bg-destructive/20 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setMediaSel(null)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-border hover:bg-muted/50"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        )}

      </div>



      {/* Editor / HTML source */}
      <div
        className={cn(
          "rich-editor-stage relative",
          scopeIdRef.current,
          fullscreen && "rich-editor-stage-fullscreen flex min-h-0 flex-1 flex-col overflow-auto",
        )}
        onClick={!showHtml ? handleEditorClick : undefined}
        onMouseOver={!showHtml ? handleEditorMouseOver : undefined}
        style={{ background: pageBg }}
      >
        {showHtml ? (
          <textarea
            value={htmlBuffer}
            onChange={(e) => {
              setHtmlBuffer(e.target.value);
              onChange(wrapContent(e.target.value, pageBg));
            }}
            spellCheck={false}
            className={cn(
              "rich-html-source w-full min-h-[400px] p-4 font-mono text-xs leading-relaxed focus:outline-none resize-y",
              fullscreen && "min-h-full flex-1 resize-none",
            )}
            placeholder="<p>Write HTML here…</p>"
          />
        ) : (
          <EditorContent
            editor={editor}
            className={cn(fullscreen && "rich-editor-shell-fullscreen")}
          />
        )}
      </div>

      {/* Link modal */}
      <Modal open={linkModal} onClose={() => setLinkModal(false)} title="Insert link">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">URL</label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              className="w-full glass rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Label (shown as the link text)</label>
            <input
              type="text"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Click here"
              className="w-full glass rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The label becomes the clickable link, and the URL is shown on the line below it.
          </p>
          <button
            type="button"
            disabled={!linkUrl}
            onClick={submitLink}
            className="w-full gradient-bg text-primary-foreground py-2 rounded-md text-sm font-medium disabled:opacity-40"
          >
            Insert
          </button>
        </div>
      </Modal>

      {/* Image modal */}
      <Modal
        open={!!imgModal}
        onClose={() => {
          setImgModal(null);
          setLinkUrl("");
        }}
        title="Insert image"
      >
        {imgModal === "menu" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setImgModal("upload")}
              className="glass rounded-xl p-4 hover:bg-muted/40 transition flex flex-col items-center gap-2 text-sm"
            >
              <Upload className="h-5 w-5 text-primary" /> Upload
            </button>
            <button
              type="button"
              onClick={() => setImgModal("link")}
              className="glass rounded-xl p-4 hover:bg-muted/40 transition flex flex-col items-center gap-2 text-sm"
            >
              <LinkIcon className="h-5 w-5 text-primary" /> Link
            </button>
          </div>
        )}
        {imgModal === "upload" && (
          <div className="space-y-3">
            <input
              ref={fileImgRef}
              type="file"
              accept="image/*"
              onChange={onImgFile}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileImgRef.current?.click()}
              className="w-full glass rounded-xl p-6 hover:bg-muted/40 transition flex flex-col items-center gap-2 text-sm"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5 text-primary" />
              )}
              {uploading ? "Uploading…" : "Choose image from device"}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              PNG, JPG, GIF, WebP — up to 10MB
            </p>
          </div>
        )}
        {imgModal === "link" && (
          <div className="space-y-3">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full glass rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
            {linkUrl && (
              <div className="rounded-md overflow-hidden border border-border bg-black/20">
                <img
                  src={linkUrl}
                  alt="preview"
                  className="w-full max-h-48 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                  }}
                />
              </div>
            )}
            <button
              type="button"
              disabled={!linkUrl}
              onClick={() => insertImage(linkUrl)}
              className="w-full gradient-bg text-primary-foreground py-2 rounded-md text-sm font-medium disabled:opacity-40"
            >
              Done
            </button>
          </div>
        )}
      </Modal>

      {/* Video modal */}
      <Modal
        open={!!vidModal}
        onClose={() => {
          setVidModal(null);
          setLinkUrl("");
        }}
        title="Insert video"
      >
        {vidModal === "menu" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVidModal("upload")}
              className="glass rounded-xl p-4 hover:bg-muted/40 transition flex flex-col items-center gap-2 text-sm"
            >
              <Upload className="h-5 w-5 text-primary" /> Upload
            </button>
            <button
              type="button"
              onClick={() => setVidModal("link")}
              className="glass rounded-xl p-4 hover:bg-muted/40 transition flex flex-col items-center gap-2 text-sm"
            >
              <LinkIcon className="h-5 w-5 text-primary" /> Link
            </button>
          </div>
        )}
        {vidModal === "upload" && (
          <div className="space-y-3">
            <input
              ref={fileVidRef}
              type="file"
              accept="video/*"
              onChange={onVidFile}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileVidRef.current?.click()}
              className="w-full glass rounded-xl p-6 hover:bg-muted/40 transition flex flex-col items-center gap-2 text-sm"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5 text-primary" />
              )}
              {uploading ? "Uploading…" : "Choose video from device"}
            </button>
            <p className="text-xs text-muted-foreground text-center">MP4, WebM — up to 100MB</p>
          </div>
        )}
        {vidModal === "link" && (
          <div className="space-y-3">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="YouTube, Vimeo, or direct .mp4 link"
              className="w-full glass rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
            {linkUrl && (
              <div className="rounded-md overflow-hidden border border-border bg-black/40 aspect-video">
                {isYoutube(linkUrl) ? (
                  <iframe
                    className="w-full h-full"
                    src={linkUrl
                      .replace("watch?v=", "embed/")
                      .replace("youtu.be/", "youtube.com/embed/")}
                    allowFullScreen
                  />
                ) : vimeoEmbed(linkUrl) ? (
                  <iframe className="w-full h-full" src={vimeoEmbed(linkUrl)!} allowFullScreen />
                ) : (
                  <video src={linkUrl} controls className="w-full h-full" />
                )}
              </div>
            )}
            <button
              type="button"
              disabled={!linkUrl}
              onClick={() => insertVideo(linkUrl, "link")}
              className="w-full gradient-bg text-primary-foreground py-2 rounded-md text-sm font-medium disabled:opacity-40"
            >
              Done
            </button>
          </div>
        )}
      </Modal>
    </div>
  );

  if (fullscreen && typeof document !== "undefined") {
    return createPortal(editorTree, document.body);
  }
  return editorTree;
}
