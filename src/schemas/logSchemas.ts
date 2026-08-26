import { z } from "zod";
import { dateRangeSchema, idParamSchema, paginationSchema } from "./commonSchemas.js";

export const logLevelSchema = z.enum(["INFO", "WARNING", "ERROR", "CRITICAL"]);
export const environmentSchema = z.enum(["development", "staging", "production"]);

export const ingestLogSchema = z.object({
  body: z.object({
    level: logLevelSchema,
    message: z.string().trim().min(1).max(2000),
    source: z.string().trim().max(120).optional(),
    environment: environmentSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    errorCode: z.string().trim().max(120).optional()
  })
});

export const listLogsSchema = z.object({
  query: paginationSchema
    .merge(dateRangeSchema)
    .extend({
      projectId: z.string().uuid().optional(),
      level: logLevelSchema.optional(),
      source: z.string().trim().max(120).optional(),
      environment: environmentSchema.optional()
    })
    .refine((query) => !query.from || !query.to || query.from <= query.to, {
      message: "from must be before to",
      path: ["from"]
    })
});

export const getLogSchema = z.object({
  params: idParamSchema
});
