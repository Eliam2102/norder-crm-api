-- Cita existed in the Prisma schema before the performance-index migration,
-- but its table creation was never committed to the migration history.
CREATE TABLE "cita" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "valoracion_id" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "modalidad" TEXT NOT NULL,
    "calcom_booking_id" TEXT,
    "calcom_event_type_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cita_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cita"
ADD CONSTRAINT "cita_paciente_id_fkey"
FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cita"
ADD CONSTRAINT "cita_valoracion_id_fkey"
FOREIGN KEY ("valoracion_id") REFERENCES "valoracion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
