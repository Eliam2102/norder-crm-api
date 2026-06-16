CREATE TABLE "resumen_paciente" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "resumen" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resumen_paciente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resumen_paciente_paciente_id_key" ON "resumen_paciente"("paciente_id");

ALTER TABLE "resumen_paciente" ADD CONSTRAINT "resumen_paciente_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
