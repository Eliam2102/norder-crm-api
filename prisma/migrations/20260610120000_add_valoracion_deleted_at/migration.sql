-- Soft delete de valoraciones (consultas)
ALTER TABLE "valoracion" ADD COLUMN "deleted_at" TIMESTAMP(3);
