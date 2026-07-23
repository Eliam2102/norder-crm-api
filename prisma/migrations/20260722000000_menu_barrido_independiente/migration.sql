ALTER TABLE "plan_menu"
ADD COLUMN "tipo_contenido" TEXT NOT NULL DEFAULT 'platillos',
ADD COLUMN "barrido_equivalencias" JSONB;
