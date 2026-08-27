import type { LogLevel } from "@prisma/client";
import crypto from "node:crypto";

export const INCIDENT_WINDOW_MS = 2 * 60 * 60 * 1000;
const MISSING_FINGERPRINT_VALUE = "__missing__";

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
  level: LogLevel;
  source?: string | null;
  environment?: string | null;
  version?: string | null;
  message: string;
  errorCode?: string | null;
}) => {
  const raw = [
    `project:${input.projectId}`,
    `level:${normalizeFingerprintValue(input.level)}`,
    `source:${normalizeFingerprintValue(input.source)}`,
    `message:${normalizeMessage(input.message)}`,
    `environment:${normalizeFingerprintValue(input.environment)}`,
    `version:${normalizeFingerprintValue(input.version)}`,
    `errorCode:${normalizeFingerprintValue(input.errorCode)}`
  ].join("|");

  return crypto.createHash("sha256").update(raw).digest("hex");
};

export const isInsideIncidentWindow = (lastOccurrenceAt: Date, now: Date) =>
  now.getTime() - lastOccurrenceAt.getTime() <= INCIDENT_WINDOW_MS;

const normalizeMessage = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

const normalizeFingerprintValue = (value?: string | null) => {
  if (!value) {
    return MISSING_FINGERPRINT_VALUE;
  }

  return value.trim().replace(/\s+/g, " ").toLowerCase();
};
