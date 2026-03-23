-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "paciente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "fecha_nacimiento" DATE NOT NULL,
    "sexo" TEXT NOT NULL,
    "estatura" DECIMAL(12,4),
    "peso" DECIMAL(12,4),
    "complexion" DECIMAL(5,2),
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nivel_membresia" TEXT NOT NULL DEFAULT 'ninguna',
    "suscripcion_id_externo" TEXT,
    "suscripcion_inicio" DATE,
    "suscripcion_fin" DATE,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datos_ejercicio" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "objetivo" TEXT,
    "gym_origen" TEXT,
    "disciplina" TEXT,
    "hora_entrenamiento" TEXT,
    "frecuencia" TEXT,
    "tiempo" TEXT,
    "detalles_adicionales" TEXT,
    "nivel_actividad" TEXT,
    "porcentaje_sedentario" INTEGER NOT NULL DEFAULT 10,
    "porcentaje_leve" INTEGER NOT NULL DEFAULT 20,
    "porcentaje_moderado" INTEGER NOT NULL DEFAULT 30,
    "porcentaje_intenso" INTEGER NOT NULL DEFAULT 40,

    CONSTRAINT "datos_ejercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumo_calorico" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "recordatorio_24h_activo" BOOLEAN NOT NULL DEFAULT false,
    "hora_desayuno" TEXT,
    "hora_colacion1" TEXT,
    "hora_almuerzo" TEXT,
    "hora_colacion2" TEXT,
    "hora_cena" TEXT,
    "ayer_desayuno" TEXT,
    "ayer_colacion1" TEXT,
    "ayer_almuerzo" TEXT,
    "ayer_colacion2" TEXT,
    "ayer_cena" TEXT,
    "usualmente_desayuno" TEXT,
    "usualmente_colacion1" TEXT,
    "usualmente_almuerzo" TEXT,
    "usualmente_colacion2" TEXT,
    "usualmente_cena" TEXT,

    CONSTRAINT "consumo_calorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "antecedentes" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "alimentos_no_gustan" TEXT,
    "alimentos_gustan" TEXT,
    "alergias" TEXT,
    "patologia" TEXT,
    "cirugias" TEXT,
    "estrenimiento" TEXT,
    "consumo_alcohol" TEXT,
    "tabaco" TEXT,
    "agua" TEXT,
    "ciclo_menstrual" TEXT,
    "signos_y_sintomas" TEXT,
    "historial_productos" TEXT,
    "recomendacion_suplementos" TEXT,

    CONSTRAINT "antecedentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valoracion" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hora" TEXT,
    "numero_valoracion" INTEGER,
    "peso_actual" DECIMAL(12,4) NOT NULL,
    "estatura" DECIMAL(12,4) NOT NULL,
    "imc" DECIMAL(12,4),
    "clasificacion_imc" TEXT,
    "pliegue_tricep" DECIMAL(12,4),
    "pliegue_bicep" DECIMAL(12,4),
    "pliegue_subescapular" DECIMAL(12,4),
    "pliegue_cresta_iliaca" DECIMAL(12,4),
    "pliegue_supraespinal" DECIMAL(12,4),
    "pliegue_abdominal" DECIMAL(12,4),
    "pliegue_muslo_frontal" DECIMAL(12,4),
    "pliegue_pantorrilla" DECIMAL(12,4),
    "suma_pliegues" DECIMAL(12,4),
    "perimetro_muneca" DECIMAL(12,4),
    "perimetro_brazo_relajado" DECIMAL(12,4),
    "perimetro_brazo_contraido" DECIMAL(12,4),
    "perimetro_pectoral" DECIMAL(12,4),
    "perimetro_cintura" DECIMAL(12,4),
    "perimetro_abdomen" DECIMAL(12,4),
    "perimetro_cadera" DECIMAL(12,4),
    "perimetro_muslo_frontal" DECIMAL(12,4),
    "perimetro_pantorrilla" DECIMAL(12,4),
    "brazo_corregido" DECIMAL(12,4),
    "pierna_corregida" DECIMAL(12,4),
    "pantorrilla_corregida" DECIMAL(12,4),
    "diametro_biestiloideo" DECIMAL(12,4),
    "diametro_biepicondilo_humero" DECIMAL(12,4),
    "diametro_biepicondilo_femur" DECIMAL(12,4),
    "bio_grasa" DECIMAL(12,4),
    "bio_agua" DECIMAL(12,4),
    "bio_musculo" DECIMAL(12,4),
    "bio_energia" DECIMAL(12,4),
    "glucosa" DECIMAL(12,4),
    "trigliceridos" DECIMAL(12,4),
    "colesterol" DECIMAL(12,4),
    "creatinina" DECIMAL(12,4),
    "acido_urico" DECIMAL(12,4),
    "frecuencia_cardiaca" INTEGER,
    "presion_arterial" TEXT,
    "porcentaje_grasa_2comp" DECIMAL(12,4),
    "kg_grasa_2comp" DECIMAL(12,4),
    "kg_masa_magra_2comp" DECIMAL(12,4),
    "superficie_corporal" DECIMAL(12,4),
    "superficie_corp" DECIMAL(12,4),
    "porcentaje_grasa_corporal_4comp" DECIMAL(12,4),
    "porcentaje_grasa_corp" DECIMAL(12,4),
    "masa_grasa_real" DECIMAL(12,4),
    "porcentaje_grasa_ideal" DECIMAL(12,4),
    "masa_grasa_ideal" DECIMAL(12,4),
    "resultado_imc_4comp" TEXT,
    "masa_visceral" DECIMAL(12,4),
    "masa_osea" DECIMAL(12,4),
    "porcentaje_masa_osea" DECIMAL(12,4),
    "porcentaje_masa_visceral" DECIMAL(12,4),
    "masa_muscular" DECIMAL(12,4),
    "porcentaje_masa_muscular" DECIMAL(12,4),
    "porcentaje_musculo_ideal" DECIMAL(12,4),
    "musculo_ideal" DECIMAL(12,4),
    "masa_magra" DECIMAL(12,4),
    "deficit_musculo" DECIMAL(12,4),
    "deficit_calorico" DECIMAL(12,4),
    "peso_ideal" DECIMAL(12,4),
    "peso_ideal_4comp" DECIMAL(12,4),
    "pt_min" DECIMAL(12,4),
    "pt_max" DECIMAL(12,4),
    "peso_ajustado" DECIMAL(12,4),
    "sobrepeso" DECIMAL(12,4),
    "indice_proporcionalidad" DECIMAL(12,4),
    "endomorfico" DECIMAL(12,4),
    "mesomorfico" DECIMAL(12,4),
    "ectomorfico" DECIMAL(12,4),
    "clasificacion_ip" TEXT,
    "indice_ponderal" DECIMAL(12,4),
    "complexion" DECIMAL(12,4),
    "clasif_complexion" TEXT,
    "esquema_competencia" TEXT,
    "etapa_competitiva" TEXT,
    "tipo_dieta_competencia" TEXT,
    "densidad_2comp" DECIMAL(12,4),
    "edad_metabolica" DECIMAL(12,4),
    "comentarios" TEXT,
    "suplementacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valoracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temario_consulta" (
    "id" TEXT NOT NULL,
    "valoracion_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "detalle" TEXT,
    "orden" INTEGER,

    CONSTRAINT "temario_consulta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "valoracion_id" TEXT,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peso" DECIMAL(5,2) NOT NULL,
    "talla" DECIMAL(4,3) NOT NULL,
    "porcentaje_grasa" DECIMAL(5,2),
    "masa_magra" DECIMAL(5,2),
    "cintura" DECIMAL(5,2),
    "cadera" DECIMAL(5,2),
    "factor_actividad" DECIMAL(3,2) NOT NULL,
    "formula_tmb_usada" TEXT NOT NULL DEFAULT 'harris_benedict',
    "imc" DECIMAL(5,2) NOT NULL,
    "tmb" DECIMAL(7,2) NOT NULL,
    "get" DECIMAL(7,2) NOT NULL,
    "ger" DECIMAL(7,2),
    "eta" DECIMAL(7,2),
    "af" DECIMAL(7,2),
    "deporte" DECIMAL(7,2),
    "gct" DECIMAL(7,2),
    "factor_deporte" DECIMAL(5,2),
    "mets_deporte" DECIMAL(5,2),
    "comentarios" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT,
    "revision_id" TEXT,
    "valoracion_id" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nombre" TEXT,
    "tipo_plan" TEXT NOT NULL,
    "calorias" INTEGER NOT NULL,
    "proteinas_pct" DECIMAL(5,2) NOT NULL,
    "carbohidratos_pct" DECIMAL(5,2) NOT NULL,
    "grasas_pct" DECIMAL(5,2) NOT NULL,
    "proteinas_kcal" INTEGER,
    "carbohidratos_kcal" INTEGER,
    "grasas_kcal" INTEGER,
    "proteinas_gr" DECIMAL(6,2),
    "carbohidratos_gr" DECIMAL(6,2),
    "grasas_gr" DECIMAL(6,2),
    "proteinas_gr_kg" DECIMAL(5,2),
    "carbohidratos_gr_kg" DECIMAL(5,2),
    "grasas_gr_kg" DECIMAL(5,2),
    "get_sedentario" DECIMAL(12,4),
    "get_leve" DECIMAL(12,4),
    "get_moderado" DECIMAL(12,4),
    "get_intenso" DECIMAL(12,4),
    "proxima_sesion" TIMESTAMP(3),
    "notas_generales" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "estado_envio" TEXT NOT NULL DEFAULT 'pendiente',
    "pdf_url" TEXT,
    "pdf_generado_at" TIMESTAMP(3),
    "pdf_custom_meta" JSONB,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_menu" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'Menú #1',
    "orden" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_tiempo_comida" (
    "id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 1,
    "nota_pie" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_tiempo_comida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_ingrediente" (
    "id" TEXT NOT NULL,
    "tiempo_comida_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(8,2),
    "unidad" TEXT,
    "eq_cantidad" DECIMAL(5,1),
    "eq_grupo" TEXT,
    "nota" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "plan_ingrediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requerimiento" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "valoracion_id" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peso" DECIMAL(12,4),
    "talla" DECIMAL(12,4),
    "edad" INTEGER,
    "sexo" TEXT,
    "nivel_actividad" TEXT,
    "formula_tmb" TEXT,
    "factor_actividad" DECIMAL(12,4),
    "tmb" DECIMAL(12,4),
    "get" DECIMAL(12,4),
    "ger" DECIMAL(12,4),
    "eta" DECIMAL(12,4),
    "af" DECIMAL(12,4),
    "deporte" DECIMAL(12,4),
    "gct" DECIMAL(12,4),
    "get_sedentario" DECIMAL(12,4),
    "get_leve" DECIMAL(12,4),
    "get_moderado" DECIMAL(12,4),
    "get_intenso" DECIMAL(12,4),
    "get_seleccionado" DECIMAL(12,4),
    "fao_oms_requerimiento" DECIMAL(12,4),
    "calc_rapido_obeso" DECIMAL(12,4),
    "calc_rapido_normal" DECIMAL(12,4),
    "calc_rapido_desnutricion" DECIMAL(12,4),
    "pct_proteinas" DECIMAL(12,4),
    "pct_carbs" DECIMAL(12,4),
    "pct_lipidos" DECIMAL(12,4),
    "kcal_proteinas" DECIMAL(12,4),
    "kcal_carbs" DECIMAL(12,4),
    "kcal_lipidos" DECIMAL(12,4),
    "gr_proteinas" DECIMAL(12,4),
    "gr_carbs" DECIMAL(12,4),
    "gr_lipidos" DECIMAL(12,4),
    "gr_kg_proteinas" DECIMAL(12,4),
    "gr_kg_carbs" DECIMAL(12,4),
    "gr_kg_lipidos" DECIMAL(12,4),
    "eq_verduras" DECIMAL(12,4),
    "eq_frutas" DECIMAL(12,4),
    "eq_cereal_sin_gr" DECIMAL(12,4),
    "eq_cereal_con_gr" DECIMAL(12,4),
    "eq_leguminosas" DECIMAL(12,4),
    "eq_aoa_muy_bajo" DECIMAL(12,4),
    "eq_aoa_bajo" DECIMAL(12,4),
    "eq_aoa_moderado" DECIMAL(12,4),
    "eq_aoa_alto" DECIMAL(12,4),
    "eq_leche_desc" DECIMAL(12,4),
    "eq_leche_semi" DECIMAL(12,4),
    "eq_leche_entera" DECIMAL(12,4),
    "eq_leche_az" DECIMAL(12,4),
    "eq_grasa_sin_prot" DECIMAL(12,4),
    "eq_grasa_con_prot" DECIMAL(12,4),
    "eq_az_sin_gr" DECIMAL(12,4),
    "eq_az_con_gr" DECIMAL(12,4),
    "distribucion_json" TEXT,
    "comentarios" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requerimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nombre" TEXT,
    "cedula" TEXT,
    "universidad" TEXT,
    "profesion" TEXT,
    "certificacion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "logo_url" TEXT,
    "firma_url" TEXT,
    "google_calendar_url" TEXT,
    "email_remitente" TEXT,
    "email_password" TEXT,
    "asunto_correo" TEXT,
    "mensaje_whats_app" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barrido_equivalencias" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "valoracion_id" TEXT NOT NULL,
    "tiempos" TEXT NOT NULL,
    "porciones" TEXT NOT NULL,
    "distribucion" TEXT NOT NULL,
    "kcalTotal" DOUBLE PRECISION,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barrido_equivalencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alimento_smae" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "peso_gramos" DOUBLE PRECISION NOT NULL,
    "porcion_casera" TEXT,
    "cantidad_porcion" DOUBLE PRECISION,
    "unidad_porcion" TEXT,
    "notas" TEXT,
    "es_personalizado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alimento_smae_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'practicante',
    "permisos" JSONB NOT NULL DEFAULT '{}',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "telefono" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paciente_telefono_key" ON "paciente"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "datos_ejercicio_paciente_id_key" ON "datos_ejercicio"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "consumo_calorico_paciente_id_key" ON "consumo_calorico"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "antecedentes_paciente_id_key" ON "antecedentes"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "barrido_equivalencias_valoracion_id_key" ON "barrido_equivalencias"("valoracion_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "datos_ejercicio" ADD CONSTRAINT "datos_ejercicio_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_calorico" ADD CONSTRAINT "consumo_calorico_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "antecedentes" ADD CONSTRAINT "antecedentes_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoracion" ADD CONSTRAINT "valoracion_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temario_consulta" ADD CONSTRAINT "temario_consulta_valoracion_id_fkey" FOREIGN KEY ("valoracion_id") REFERENCES "valoracion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temario_consulta" ADD CONSTRAINT "temario_consulta_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision" ADD CONSTRAINT "revision_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision" ADD CONSTRAINT "revision_valoracion_id_fkey" FOREIGN KEY ("valoracion_id") REFERENCES "valoracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan" ADD CONSTRAINT "plan_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan" ADD CONSTRAINT "plan_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan" ADD CONSTRAINT "plan_valoracion_id_fkey" FOREIGN KEY ("valoracion_id") REFERENCES "valoracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_menu" ADD CONSTRAINT "plan_menu_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_tiempo_comida" ADD CONSTRAINT "plan_tiempo_comida_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "plan_menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_ingrediente" ADD CONSTRAINT "plan_ingrediente_tiempo_comida_id_fkey" FOREIGN KEY ("tiempo_comida_id") REFERENCES "plan_tiempo_comida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requerimiento" ADD CONSTRAINT "requerimiento_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requerimiento" ADD CONSTRAINT "requerimiento_valoracion_id_fkey" FOREIGN KEY ("valoracion_id") REFERENCES "valoracion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barrido_equivalencias" ADD CONSTRAINT "barrido_equivalencias_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barrido_equivalencias" ADD CONSTRAINT "barrido_equivalencias_valoracion_id_fkey" FOREIGN KEY ("valoracion_id") REFERENCES "valoracion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

