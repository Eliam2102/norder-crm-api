ALTER TABLE "datos_ejercicio" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "valoracion" ADD COLUMN "otros_bioquimicos" TEXT;
ALTER TABLE "paciente" ADD COLUMN "mostrar_bioimpedancia" BOOLEAN NOT NULL DEFAULT true;
UPDATE "paciente" SET "mostrar_bioimpedancia" = false WHERE "id" = 'a6036248-322d-42cd-8ab5-505daf5173d9';
