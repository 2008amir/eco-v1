ALTER TABLE public.research ADD COLUMN IF NOT EXISTS post_kind text NOT NULL DEFAULT 'research';
ALTER TABLE public.research DROP CONSTRAINT IF EXISTS research_post_kind_check;
ALTER TABLE public.research ADD CONSTRAINT research_post_kind_check CHECK (post_kind IN ('research','project','broadcast','news'));
CREATE INDEX IF NOT EXISTS research_post_kind_idx ON public.research (post_kind, created_at DESC);