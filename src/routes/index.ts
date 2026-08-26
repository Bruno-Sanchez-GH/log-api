import { Router } from "express";
import { z } from "zod";
import * as apiKeyController from "../controllers/apiKeyController.js";
import * as authController from "../controllers/authController.js";
import * as incidentController from "../controllers/incidentController.js";
import * as logController from "../controllers/logController.js";
import * as projectController from "../controllers/projectController.js";
import { authenticateApiKey } from "../middleware/authenticateApiKey.js";
import { authenticateJwt } from "../middleware/authenticateJwt.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { loginSchema, registerSchema } from "../schemas/authSchemas.js";
import { idParamSchema, projectIdParamSchema } from "../schemas/commonSchemas.js";
import { incidentIdSchema, listIncidentsSchema } from "../schemas/incidentSchemas.js";
import { getLogSchema, ingestLogSchema, listLogsSchema } from "../schemas/logSchemas.js";
import { createProjectSchema, updateProjectSchema } from "../schemas/projectSchemas.js";

export const router = Router();

router.post("/auth/register", validateRequest(registerSchema), authController.register);
router.post("/auth/login", validateRequest(loginSchema), authController.login);

router.post("/logs/ingest", authenticateApiKey, validateRequest(ingestLogSchema), logController.ingest);

router.use(authenticateJwt);

router.post("/projects", validateRequest(createProjectSchema), projectController.create);
router.get("/projects", projectController.list);
router.get("/projects/:id", validateRequest(z.object({ params: idParamSchema })), projectController.getById);
router.patch("/projects/:id", validateRequest(updateProjectSchema), projectController.update);
router.delete("/projects/:id", validateRequest(z.object({ params: idParamSchema })), projectController.deactivate);

router.post(
  "/projects/:projectId/api-keys",
  validateRequest(z.object({ params: projectIdParamSchema })),
  apiKeyController.generate
);
router.get(
  "/projects/:projectId/api-keys",
  validateRequest(z.object({ params: projectIdParamSchema })),
  apiKeyController.list
);
router.patch(
  "/projects/:projectId/api-keys/:id/revoke",
  validateRequest(z.object({ params: projectIdParamSchema.merge(idParamSchema) })),
  apiKeyController.revoke
);

router.get("/logs", validateRequest(listLogsSchema), logController.list);
router.get("/logs/:id", validateRequest(getLogSchema), logController.getById);

router.get("/incidents", validateRequest(listIncidentsSchema), incidentController.list);
router.get("/incidents/:id", validateRequest(incidentIdSchema), incidentController.getById);
router.patch("/incidents/:id/resolve", validateRequest(incidentIdSchema), incidentController.resolve);
