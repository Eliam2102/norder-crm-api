-- Corrección autorizada el 31 de octubre de 2026; requiere respaldo previo.
-- La excepción pertenece a la valoración indicada el 23 de septiembre.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10s';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM paciente
        WHERE id = 'a6036248-322d-42cd-8ab5-505daf5173d9'
          AND nombre = 'Tomas' AND apellido = 'Castellanos'
    ) OR NOT EXISTS (
        SELECT 1 FROM valoracion
        WHERE id = '5902f06c-37cf-4e10-a67c-89659154822d'
          AND paciente_id = 'a6036248-322d-42cd-8ab5-505daf5173d9'
    ) THEN
        RAISE EXCEPTION 'El paciente o la valoración no coinciden; no aplicar';
    END IF;
END $$;

UPDATE valoracion
SET mediciones_estado = COALESCE(mediciones_estado, '{}'::jsonb)
    || '{"mostrarBioimpedancia":false}'::jsonb
WHERE id = '5902f06c-37cf-4e10-a67c-89659154822d'
  AND paciente_id = 'a6036248-322d-42cd-8ab5-505daf5173d9';

UPDATE paciente
SET mostrar_bioimpedancia = true
WHERE id = 'a6036248-322d-42cd-8ab5-505daf5173d9';

COMMIT;
