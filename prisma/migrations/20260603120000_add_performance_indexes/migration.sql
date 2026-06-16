-- Performance indexes: add missing FK and date indexes across all models

-- Paciente
CREATE INDEX IF NOT EXISTS "paciente_nivel_membresia_idx" ON "paciente"("nivel_membresia");
CREATE INDEX IF NOT EXISTS "paciente_fecha_registro_idx" ON "paciente"("fecha_registro");

-- Valoracion
CREATE INDEX IF NOT EXISTS "valoracion_paciente_id_idx" ON "valoracion"("paciente_id");
CREATE INDEX IF NOT EXISTS "valoracion_fecha_idx" ON "valoracion"("fecha");

-- TemarioConsulta
CREATE INDEX IF NOT EXISTS "temario_consulta_valoracion_id_idx" ON "temario_consulta"("valoracion_id");
CREATE INDEX IF NOT EXISTS "temario_consulta_paciente_id_idx" ON "temario_consulta"("paciente_id");

-- Revision
CREATE INDEX IF NOT EXISTS "revision_paciente_id_idx" ON "revision"("paciente_id");

-- Plan
CREATE INDEX IF NOT EXISTS "plan_paciente_id_idx" ON "plan"("paciente_id");
CREATE INDEX IF NOT EXISTS "plan_valoracion_id_idx" ON "plan"("valoracion_id");
CREATE INDEX IF NOT EXISTS "plan_fecha_creacion_idx" ON "plan"("fecha_creacion");
CREATE INDEX IF NOT EXISTS "plan_estado_envio_idx" ON "plan"("estado_envio");

-- PlanMenu
CREATE INDEX IF NOT EXISTS "plan_menu_plan_id_idx" ON "plan_menu"("plan_id");

-- PlanTiempoComida
CREATE INDEX IF NOT EXISTS "plan_tiempo_comida_menu_id_idx" ON "plan_tiempo_comida"("menu_id");

-- PlanIngrediente
CREATE INDEX IF NOT EXISTS "plan_ingrediente_tiempo_comida_id_idx" ON "plan_ingrediente"("tiempo_comida_id");

-- Requerimiento
CREATE INDEX IF NOT EXISTS "requerimiento_paciente_id_idx" ON "requerimiento"("paciente_id");
CREATE INDEX IF NOT EXISTS "requerimiento_valoracion_id_idx" ON "requerimiento"("valoracion_id");

-- BarridoEquivalencias
CREATE INDEX IF NOT EXISTS "barrido_equivalencias_paciente_id_idx" ON "barrido_equivalencias"("paciente_id");

-- Cita
CREATE INDEX IF NOT EXISTS "cita_paciente_id_idx" ON "cita"("paciente_id");
CREATE INDEX IF NOT EXISTS "cita_valoracion_id_idx" ON "cita"("valoracion_id");
CREATE INDEX IF NOT EXISTS "cita_fecha_idx" ON "cita"("fecha");
