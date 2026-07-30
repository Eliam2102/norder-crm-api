ALTER TABLE "paciente"
ADD COLUMN "stripe_customer_id" TEXT,
ADD COLUMN "suscripcion_estado" TEXT,
ADD COLUMN "ultima_checkout_id" TEXT;

CREATE UNIQUE INDEX "paciente_stripe_customer_id_key"
ON "paciente"("stripe_customer_id");

CREATE TABLE "stripe_evento" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'procesando',
    "intentos" INTEGER NOT NULL DEFAULT 1,
    "ultimo_error" TEXT,
    "procesado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_evento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stripe_evento_estado_actualizado_en_idx"
ON "stripe_evento"("estado", "actualizado_en");
