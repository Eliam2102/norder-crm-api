-- Add farmacos column to antecedentes table
ALTER TABLE "antecedentes" ADD COLUMN IF NOT EXISTS "farmacos" TEXT;
