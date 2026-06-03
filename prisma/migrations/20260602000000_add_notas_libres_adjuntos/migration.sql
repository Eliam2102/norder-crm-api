-- Add notas_libres and adjuntos_json columns to Valoracion table
ALTER TABLE "valoracion" ADD COLUMN IF NOT EXISTS "notas_libres" TEXT;
ALTER TABLE "valoracion" ADD COLUMN IF NOT EXISTS "adjuntos_json" JSONB;
