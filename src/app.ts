import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { router } from "./routes/index.js";
import { setupSwagger } from "./swagger.js";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  setupSwagger(app);
  app.use("/api/v1", router);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
