-- AlterTable
ALTER TABLE "plan_ingrediente" ADD COLUMN     "platillo" TEXT;

-- CreateTable
CREATE TABLE "platillo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Desayuno',
    "ingredientes" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platillo_pkey" PRIMARY KEY ("id")
);
