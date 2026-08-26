# Freelance Log API

API REST local para centralizar logs e incidentes de varios proyectos en un solo lugar.

## Problematica

Un freelancer puede mantener paginas web, APIs y aplicaciones para distintos clientes. Cuando algo falla en produccion, la informacion suele quedar repartida entre servidores, consolas y servicios diferentes.

Esta API permite que cada proyecto envie logs por HTTP usando una API Key propia. Luego, el freelancer autenticado con JWT puede consultar solo sus proyectos, logs e incidentes.

## Objetivo

Crear una alternativa liviana, local y educativa frente a herramientas de observabilidad mas complejas. La V1 prioriza claridad, seguridad basica y una estructura facil de estudiar.

## Caracteristicas V1

- Registro y login de freelancers.
- JWT para rutas administrativas.
- Proyectos por freelancer.
- API Keys por proyecto, almacenadas como hash.
- Revocacion de API Keys.
- Recepcion publica de logs con header `x-api-key`.
- Consulta de logs propios con filtros y paginacion.
- Incidentes para logs `ERROR` y `CRITICAL`.
- Agrupacion simple por `errorCode` o por `source + message`.
- Ventana temporal de 2 horas desde la ultima ocurrencia.
- Swagger local en `/docs`.
- Tests basicos de flujos principales.

## Stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma ORM
- Zod
- Swagger / OpenAPI
- JWT
- API Keys
- Vitest + Supertest

## Requisitos

- Node.js 24 o superior.
- npm.
- Git.
- PostgreSQL local corriendo en `localhost:5432`.

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores si hace falta.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/freelance_log_api?schema=public"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/freelance_log_api_test?schema=public"
JWT_SECRET="change-this-local-secret"
JWT_EXPIRES_IN="1d"
PORT=3000
NODE_ENV="development"
```

## Instalacion

```powershell
npm install
```

## Migraciones

```powershell
npm run prisma:migrate
```

## Iniciar servidor

```powershell
npm run dev
```

Servidor:

```text
http://localhost:3000
```

Swagger:

```text
http://localhost:3000/docs
```

## Ejemplo para enviar un log

Primero registra un usuario, crea un proyecto y genera una API Key desde Swagger. La API Key real solo aparece cuando se crea.

Luego envia un log:

```powershell
curl -X POST http://localhost:3000/api/v1/logs/ingest `
  -H "Content-Type: application/json" `
  -H "x-api-key: TU_API_KEY" `
  -d "{\"level\":\"ERROR\",\"message\":\"User 15 not found\",\"source\":\"users-api\",\"environment\":\"production\",\"errorCode\":\"USER_NOT_FOUND\",\"metadata\":{\"endpoint\":\"/users/15\",\"method\":\"GET\",\"statusCode\":404}}"
```

## Scripts

- `npm run dev`: inicia el servidor en modo desarrollo.
- `npm run build`: compila TypeScript.
- `npm start`: ejecuta la version compilada.
- `npm test`: ejecuta tests.
- `npm run prisma:migrate`: crea/aplica migraciones.
- `npm run prisma:studio`: abre Prisma Studio.

## Roadmap

Futuras versiones, no implementadas en esta V1:

- Priorizacion automatica de incidentes.
- Impact score.
- SDK para Node.js.
- Integracion simplificada mediante middleware.
- Posible analisis asistido por IA.
- Deploy.
- Dashboard opcional.
