-- Lista estructurada de fármacos (nombre, tiempo tomando, activo) en expediente
ALTER TABLE "antecedentes" ADD COLUMN "farmacos_detalle" JSONB;
