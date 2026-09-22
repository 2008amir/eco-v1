import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { RESEARCH_TEMPLATES } from "@/lib/research-templates";

const TemplateInlineEditor = lazy(() =>
  import("@/components/TemplateInlineEditor").then((m) => ({ default: m.TemplateInlineEditor })),
);

export const Route = createFileRoute("/admin/research/templates")({
  component: TemplatesPage,
  head: () => ({ meta: [{ title: "Templates — Ecomedic Admin" }] }),
});

const STORAGE_KEY = "ecomedic-template-html";

function TemplatesPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; html: string } | null>(null);

  const openTemplate = (templateId: string) => {
    const t = RESEARCH_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setEditing({ id: t.id, html: t.content_html });
  };

  const handleDone = (html: string) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, html);
    } catch {
      // ignore quota errors
    }
    setEditing(null);
    navigate({ to: "/admin/research/new", search: { template: "custom" } });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Research Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick a ready-made template — it opens like a website you can edit. Click any text to change it, click any image/video to replace.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {RESEARCH_TEMPLATES.map((t) => (
          <div
            key={t.id}
            className={cn(
              "glass rounded-2xl overflow-hidden cursor-pointer transition-all hover:glow group",
              selected === t.id && "ring-2 ring-primary glow",
            )}
            onClick={() => setSelected(t.id === selected ? null : t.id)}
          >
            <div className="h-40 relative overflow-hidden" style={{ background: t.preview_bg }}>
              <div
                className="absolute inset-0 scale-[0.25] origin-top-left w-[400%] h-[400%] pointer-events-none"
                dangerouslySetInnerHTML={{ __html: t.content_html }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-sm">{t.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
              <button
                onClick={(e) => { e.stopPropagation(); openTemplate(t.id); }}
                className="mt-3 w-full gradient-bg text-primary-foreground py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition"
              >
                Open & edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Suspense fallback={null}>
          <TemplateInlineEditor
            initialHtml={editing.html}
            onCancel={() => setEditing(null)}
            onDone={handleDone}
          />
        </Suspense>
      )}
    </div>
  );
}
