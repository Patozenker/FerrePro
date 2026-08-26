-- ==============================================================================
-- SCHEMA SUPABASE: FERRETERÍA PRO
-- ==============================================================================

-- 1. Crear tabla principal para sincronización y almacenamiento en tiempo real
CREATE TABLE IF NOT EXISTS public.store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.store ENABLE ROW LEVEL SECURITY;

-- 3. Crear política para permitir lectura y escritura con la anon key
DROP POLICY IF EXISTS "Permitir acceso público a store" ON public.store;
CREATE POLICY "Permitir acceso público a store"
    ON public.store
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Habilitar replicación en tiempo real (Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.store;
