-- Cada valoración conserva la fotografía de Dietética usada para construir su barrido.
-- Es nullable para mantener intactas las valoraciones históricas existentes.
ALTER TABLE "valoracion"
ADD COLUMN "dietetica" JSONB;
