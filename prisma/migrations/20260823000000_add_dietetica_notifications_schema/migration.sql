-- Add the consolidated notes field used by the new diet history UI.
ALTER TABLE "habito_alimentario"
ADD COLUMN "notas" TEXT;

-- Track the last modification used to order recent clinical activity.
ALTER TABLE "valoracion"
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "plan"
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Persist outbound delivery retries when both n8n and the direct fallback fail.
CREATE TABLE "outbound_message_queue" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "canales" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "max_intentos" INTEGER NOT NULL DEFAULT 2880,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "ultimo_error" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_message_queue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbound_message_queue_estado_intentos_idx"
ON "outbound_message_queue"("estado", "intentos");

CREATE INDEX "outbound_message_queue_plan_id_idx"
ON "outbound_message_queue"("plan_id");

ALTER TABLE "outbound_message_queue"
ADD CONSTRAINT "outbound_message_queue_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "plan"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outbound_message_queue"
ADD CONSTRAINT "outbound_message_queue_paciente_id_fkey"
FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Reconcile schema changes that historically reached Neon without a migration.
ALTER TABLE "alimento_smae"
ADD COLUMN "equivalencias" JSONB,
ADD COLUMN "unidad_base" TEXT NOT NULL DEFAULT 'g';

ALTER TABLE "paciente"
ADD COLUMN "portal_activo" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "plan"
ADD COLUMN "suplementosDetalle" JSONB;

ALTER TABLE "plan_ingrediente"
ADD COLUMN "equivalencias" JSONB,
ADD COLUMN "smae_gr_por_eq" DOUBLE PRECISION;

ALTER TABLE "plan_tiempo_comida"
ADD COLUMN "bebida" TEXT,
ADD COLUMN "supl_notas" TEXT,
ADD COLUMN "supl_tiempo" TEXT;

ALTER TABLE "valoracion"
ADD COLUMN "evitar" TEXT,
ADD COLUMN "suplementosDetalle" JSONB;

CREATE TABLE "mensaje_portal" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "tiene_imagen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensaje_portal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mensaje_portal_paciente_id_created_at_idx"
ON "mensaje_portal"("paciente_id", "created_at");

ALTER TABLE "mensaje_portal"
ADD CONSTRAINT "mensaje_portal_paciente_id_fkey"
FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Its records were copied into habito_alimentario by the 20260629 migration.
DROP TABLE "consumo_calorico";
