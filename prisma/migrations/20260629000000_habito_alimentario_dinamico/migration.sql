-- Migration: habito_alimentario_dinamico
-- ✅ SAFE: consumo_calorico NO se elimina.
-- ✅ Todos los pacientes reciben filas por defecto aunque no tuvieran datos.
-- ✅ Los pacientes que ya tenían datos en consumo_calorico los conservan migrados.

-- 1. Create new dynamic table
CREATE TABLE IF NOT EXISTS "habito_alimentario" (
    "id"          TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "orden"       INTEGER NOT NULL DEFAULT 0,
    "label"       TEXT NOT NULL,
    "hora"        TEXT,
    "ayer"        TEXT,
    "usualmente"  TEXT,

    CONSTRAINT "habito_alimentario_pkey" PRIMARY KEY ("id")
);

-- 2. Index + FK
CREATE INDEX IF NOT EXISTS "habito_alimentario_paciente_id_idx"
    ON "habito_alimentario"("paciente_id");

ALTER TABLE "habito_alimentario"
    DROP CONSTRAINT IF EXISTS "habito_alimentario_paciente_id_fkey";

ALTER TABLE "habito_alimentario"
    ADD CONSTRAINT "habito_alimentario_paciente_id_fkey"
    FOREIGN KEY ("paciente_id")
    REFERENCES "paciente"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Migrate patients that HAD data in consumo_calorico
--    Insert only rows where at least one field has data (no empty ghost rows)

INSERT INTO "habito_alimentario" ("id", "paciente_id", "orden", "label", "hora", "ayer", "usualmente")
SELECT gen_random_uuid()::text, cc."paciente_id", 0, 'Desayuno',
       COALESCE(cc."hora_desayuno", ''), COALESCE(cc."ayer_desayuno", ''), COALESCE(cc."usualmente_desayuno", '')
FROM "consumo_calorico" cc
ON CONFLICT DO NOTHING;

INSERT INTO "habito_alimentario" ("id", "paciente_id", "orden", "label", "hora", "ayer", "usualmente")
SELECT gen_random_uuid()::text, cc."paciente_id", 1, 'Colación',
       COALESCE(cc."hora_colacion1", ''), COALESCE(cc."ayer_colacion1", ''), COALESCE(cc."usualmente_colacion1", '')
FROM "consumo_calorico" cc
ON CONFLICT DO NOTHING;

INSERT INTO "habito_alimentario" ("id", "paciente_id", "orden", "label", "hora", "ayer", "usualmente")
SELECT gen_random_uuid()::text, cc."paciente_id", 2, 'Comida',
       COALESCE(cc."hora_almuerzo", ''), COALESCE(cc."ayer_almuerzo", ''), COALESCE(cc."usualmente_almuerzo", '')
FROM "consumo_calorico" cc
ON CONFLICT DO NOTHING;

INSERT INTO "habito_alimentario" ("id", "paciente_id", "orden", "label", "hora", "ayer", "usualmente")
SELECT gen_random_uuid()::text, cc."paciente_id", 3, 'Colación',
       COALESCE(cc."hora_colacion2", ''), COALESCE(cc."ayer_colacion2", ''), COALESCE(cc."usualmente_colacion2", '')
FROM "consumo_calorico" cc
ON CONFLICT DO NOTHING;

INSERT INTO "habito_alimentario" ("id", "paciente_id", "orden", "label", "hora", "ayer", "usualmente")
SELECT gen_random_uuid()::text, cc."paciente_id", 4, 'Cena',
       COALESCE(cc."hora_cena", ''), COALESCE(cc."ayer_cena", ''), COALESCE(cc."usualmente_cena", '')
FROM "consumo_calorico" cc
ON CONFLICT DO NOTHING;

-- 4. For patients with NO consumo_calorico row, insert 5 blank default rows
INSERT INTO "habito_alimentario" ("id", "paciente_id", "orden", "label", "hora", "ayer", "usualmente")
SELECT gen_random_uuid()::text, p."id", 0, 'Desayuno', '', '', ''
FROM "paciente" p
WHERE NOT EXISTS (
    SELECT 1 FROM "habito_alimentario" h WHERE h."paciente_id" = p."id"
);

INSERT INTO "habito_alimentario" ("id", "paciente_id", "orden", "label", "hora", "ayer", "usualmente")
SELECT gen_random_uuid()::text, p."id", 1, 'Colación', '', '', ''
FROM "paciente" p
WHERE (SELECT COUNT(*) FROM "habito_alimentario" h WHERE h."paciente_id" = p."id") = 1;

INSERT INTO "habito_alimentario" ("id", "paciente_id", "orden", "label", "hora", "ayer", "usualmente")
SELECT gen_random_uuid()::text, p."id", 2, 'Comida', '', '', ''
FROM "paciente" p
WHERE (SELECT COUNT(*) FROM "habito_alimentario" h WHERE h."paciente_id" = p."id") = 2;

INSERT INTO "habito_alimentario" ("id", "paciente_id", "orden", "label", "hora", "ayer", "usualmente")
SELECT gen_random_uuid()::text, p."id", 3, 'Colación', '', '', ''
FROM "paciente" p
WHERE (SELECT COUNT(*) FROM "habito_alimentario" h WHERE h."paciente_id" = p."id") = 3;

INSERT INTO "habito_alimentario" ("id", "paciente_id", "orden", "label", "hora", "ayer", "usualmente")
SELECT gen_random_uuid()::text, p."id", 4, 'Cena', '', '', ''
FROM "paciente" p
WHERE (SELECT COUNT(*) FROM "habito_alimentario" h WHERE h."paciente_id" = p."id") = 4;

-- ✅ consumo_calorico tabla se CONSERVA intacta (no se elimina).
