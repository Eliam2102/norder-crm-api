-- Add suplementos_detalle JSON column to antecedentes table
ALTER TABLE "antecedentes" ADD COLUMN IF NOT EXISTS "suplementos_detalle" JSONB;
