import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

const openApiDocument = {
  openapi: "3.0.0",
  info: {
    title: "Freelance Log API",
    version: "2.0.0",
    description: "API REST local para centralizar logs e incidentes de proyectos freelance."
  },
  servers: [{ url: "http://localhost:3000/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      },
      apiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key"
      }
    },
    schemas: {
      RegisterInput: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", example: "Ada Lovelace" },
          email: { type: "string", example: "ada@example.com" },
          password: { type: "string", example: "password123" }
        }
      },
      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "ada@example.com" },
          password: { type: "string", example: "password123" }
        }
      },
      ProjectInput: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", example: "Client website" },
          description: { type: "string", example: "WordPress and custom API monitoring" }
        }
      },
      LogInput: {
        type: "object",
        required: ["level", "message"],
        properties: {
          level: { type: "string", enum: ["INFO", "WARNING", "ERROR", "CRITICAL"] },
          message: { type: "string", example: "User 15 not found" },
          source: { type: "string", example: "users-api" },
          environment: { type: "string", enum: ["development", "staging", "production"] },
          version: { type: "string", example: "1.4.3" },
          errorCode: { type: "string", example: "USER_NOT_FOUND" },
          metadata: {
            type: "object",
            additionalProperties: true,
            example: { endpoint: "/users/15", method: "GET", statusCode: 404 }
          }
        }
      },
      IncidentOutput: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          projectId: { type: "string", format: "uuid" },
          fingerprint: { type: "string" },
          status: { type: "string", enum: ["OPEN", "RESOLVED"] },
          severity: { type: "string", enum: ["ERROR", "CRITICAL"] },
          firstOccurrenceAt: { type: "string", format: "date-time" },
          lastOccurrenceAt: { type: "string", format: "date-time" },
          firstSeen: { type: "string", format: "date-time" },
          lastSeen: { type: "string", format: "date-time" },
          occurrenceCount: { type: "integer", example: 27 },
          durationMs: { type: "integer", example: 1980000 }
        }
      }
    }
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Registrar freelancer",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterInput" } } }
        },
        responses: { "201": { description: "Usuario registrado" }, "409": { description: "Email existente" } }
      }
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Iniciar sesion",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginInput" } } }
        },
        responses: { "200": { description: "Login exitoso" }, "401": { description: "Credenciales invalidas" } }
      }
    },
    "/projects": {
      get: {
        tags: ["Projects"],
        summary: "Listar proyectos propios",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de proyectos" }, "401": { description: "JWT faltante" } }
      },
      post: {
        tags: ["Projects"],
        summary: "Crear proyecto",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProjectInput" } } }
        },
        responses: { "201": { description: "Proyecto creado" }, "400": { description: "Datos invalidos" } }
      }
    },
    "/projects/{id}": {
      get: {
        tags: ["Projects"],
        summary: "Obtener proyecto propio",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Proyecto" }, "403": { description: "Recurso ajeno" }, "404": { description: "No existe" } }
      },
      patch: {
        tags: ["Projects"],
        summary: "Actualizar proyecto",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Proyecto actualizado" } }
      },
      delete: {
        tags: ["Projects"],
        summary: "Desactivar proyecto",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Proyecto desactivado" } }
      }
    },
    "/projects/{projectId}/api-keys": {
      get: {
        tags: ["API Keys"],
        summary: "Listar API Keys sin exponer secretos",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Credenciales seguras" } }
      },
      post: {
        tags: ["API Keys"],
        summary: "Generar API Key para un proyecto propio",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "201": { description: "Devuelve la API Key solo esta vez" } }
      }
    },
    "/projects/{projectId}/api-keys/{id}/revoke": {
      patch: {
        tags: ["API Keys"],
        summary: "Revocar API Key",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: { "200": { description: "API Key revocada" } }
      }
    },
    "/logs/ingest": {
      post: {
        tags: ["Logs"],
        summary: "Recibir log desde una aplicacion externa",
        security: [{ apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LogInput" },
              examples: {
                errorWithContext: {
                  value: {
                    level: "ERROR",
                    message: "Database connection failed",
                    source: "database",
                    environment: "production",
                    version: "1.4.3",
                    errorCode: "DB_CONNECTION_FAILED",
                    metadata: { host: "db-1", pool: "main" }
                  }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Log almacenado" },
          "400": { description: "Datos invalidos" },
          "401": { description: "API Key faltante o invalida" }
        }
      }
    },
    "/logs": {
      get: {
        tags: ["Logs"],
        summary: "Listar logs propios con filtros y paginacion",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "projectId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "level", in: "query", schema: { type: "string", enum: ["INFO", "WARNING", "ERROR", "CRITICAL"] } },
          { name: "source", in: "query", schema: { type: "string" } },
          { name: "environment", in: "query", schema: { type: "string", enum: ["development", "staging", "production"] } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } }
        ],
        responses: { "200": { description: "Logs paginados" } }
      }
    },
    "/logs/{id}": {
      get: {
        tags: ["Logs"],
        summary: "Obtener detalle de log propio",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Log" }, "403": { description: "Recurso ajeno" } }
      }
    },
    "/incidents": {
      get: {
        tags: ["Incidents"],
        summary: "Listar incidentes propios",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "projectId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["OPEN", "RESOLVED"] } },
          { name: "severity", in: "query", schema: { type: "string", enum: ["ERROR", "CRITICAL"] } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } }
        ],
        responses: {
          "200": {
            description: "Incidentes paginados con primera/ultima ocurrencia y cantidad de eventos agrupados",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/IncidentOutput" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/incidents/{id}": {
      get: {
        tags: ["Incidents"],
        summary: "Obtener incidente propio",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Incidente con firstSeen, lastSeen y occurrenceCount",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/IncidentOutput" }
              }
            }
          }
        }
      }
    },
    "/incidents/{id}/resolve": {
      patch: {
        tags: ["Incidents"],
        summary: "Resolver incidente manualmente",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Incidente resuelto" } }
      }
    }
  }
};

export const setupSwagger = (app: Express) => {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
};
