ALTER TABLE "valoracion"
  ALTER COLUMN "peso_actual" DROP NOT NULL,
  ALTER COLUMN "estatura" DROP NOT NULL,
  ADD COLUMN "mediciones_estado" JSONB;

ALTER TABLE "cita" ADD COLUMN "valoracion_atendida_id" TEXT;
CREATE UNIQUE INDEX "cita_valoracion_atendida_id_key" ON "cita"("valoracion_atendida_id");
CREATE INDEX "cita_valoracion_atendida_id_idx" ON "cita"("valoracion_atendida_id");
ALTER TABLE "cita" ADD CONSTRAINT "cita_valoracion_atendida_id_fkey"
  FOREIGN KEY ("valoracion_atendida_id") REFERENCES "valoracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "foto_seguimiento" (
  "id" TEXT NOT NULL,
  "paciente_id" TEXT NOT NULL,
  "valoracion_id" TEXT NOT NULL,
  "datos" BYTEA NOT NULL,
  "mime_type" TEXT NOT NULL,
  "nombre_original" TEXT,
  "tamano_bytes" INTEGER NOT NULL,
  "ancho" INTEGER,
  "alto" INTEGER,
  "es_principal" BOOLEAN NOT NULL DEFAULT false,
  "cargada_por_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "foto_seguimiento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "foto_seguimiento_log" (
  "id" TEXT NOT NULL,
  "paciente_id" TEXT NOT NULL,
  "valoracion_id" TEXT NOT NULL,
  "foto_id" TEXT,
  "actor_id" TEXT,
  "actor_tipo" TEXT NOT NULL,
  "accion" TEXT NOT NULL,
  "detalle" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "foto_seguimiento_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "foto_seguimiento_paciente_id_created_at_idx" ON "foto_seguimiento"("paciente_id", "created_at");
CREATE INDEX "foto_seguimiento_valoracion_id_created_at_idx" ON "foto_seguimiento"("valoracion_id", "created_at");
CREATE INDEX "foto_seguimiento_log_paciente_id_created_at_idx" ON "foto_seguimiento_log"("paciente_id", "created_at");
CREATE INDEX "foto_seguimiento_log_valoracion_id_created_at_idx" ON "foto_seguimiento_log"("valoracion_id", "created_at");

ALTER TABLE "foto_seguimiento" ADD CONSTRAINT "foto_seguimiento_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "foto_seguimiento" ADD CONSTRAINT "foto_seguimiento_valoracion_id_fkey"
  FOREIGN KEY ("valoracion_id") REFERENCES "valoracion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "foto_seguimiento_log" ADD CONSTRAINT "foto_seguimiento_log_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "foto_seguimiento_log" ADD CONSTRAINT "foto_seguimiento_log_valoracion_id_fkey"
  FOREIGN KEY ("valoracion_id") REFERENCES "valoracion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "foto_seguimiento_log" ADD CONSTRAINT "foto_seguimiento_log_foto_id_fkey"
  FOREIGN KEY ("foto_id") REFERENCES "foto_seguimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
