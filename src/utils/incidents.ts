import type { LogLevel } from "@prisma/client";
import crypto from "node:crypto";

export const INCIDENT_WINDOW_MS = 2 * 60 * 60 * 1000;

export const shouldCreateIncidentForLevel = (level: LogLevel) => level === "ERROR" || level === "CRITICAL";

export const getHighestSeverity = (current: LogLevel, incoming: LogLevel): LogLevel => {
  const rank: Record<LogLevel, number> = {
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    CRITICAL: 4
  };

  return rank[incoming] > rank[current] ? incoming : current;
};

export const buildIncidentFingerprint = (input: {
  projectId: string;
  source?: string | null;
  message: string;
  errorCode?: string | null;
}) => {
  const raw = input.errorCode
    ? `${input.projectId}:code:${input.errorCode}`
    : `${input.projectId}:source:${input.source ?? "unknown"}:message:${input.message}`;

  return crypto.createHash("sha256").update(raw).digest("hex");
};

export const isInsideIncidentWindow = (lastOccurrenceAt: Date, now: Date) =>
  now.getTime() - lastOccurrenceAt.getTime() <= INCIDENT_WINDOW_MS;
