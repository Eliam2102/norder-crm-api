-- AddColumn: esche_hidratacion to valoracion
ALTER TABLE "valoracion" ADD COLUMN IF NOT EXISTS "esche_hidratacion" TEXT;
