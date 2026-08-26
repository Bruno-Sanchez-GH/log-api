import { z } from "zod";
import { idParamSchema, paginationSchema } from "./commonSchemas.js";
import { logLevelSchema } from "./logSchemas.js";

export const listIncidentsSchema = z.object({
  query: paginationSchema.extend({
    projectId: z.string().uuid().optional(),
    status: z.enum(["OPEN", "RESOLVED"]).optional(),
    severity: logLevelSchema.optional()
  })
});

export const incidentIdSchema = z.object({
  params: idParamSchema
});
