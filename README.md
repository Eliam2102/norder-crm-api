# Express.js + Prisma Project

Este es un proyecto base de Express.js con Prisma ORM (v7) configurado con SQLite.

## Requisitos

- Node.js installed

## Instalación

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Genera el cliente de Prisma:
   ```bash
   npm run prisma:generate
   ```

3. Sincroniza la base de datos:
   ```bash
   npx prisma db push
   ```

## Ejecución

Para iniciar el servidor en modo desarrollo con auto-recarga:

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`.

## Endpoints disponibles

- `GET /`: Mensaje de bienvenida.
- `GET /users`: Obtiene todos los usuarios.
- `POST /users`: Crea un nuevo usuario. Ejemplo de body:
  ```json
  {
    "email": "test@example.com",
    "name": "Juan Perez"
  }
  ```
