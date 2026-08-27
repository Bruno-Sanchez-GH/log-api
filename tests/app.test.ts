import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { INCIDENT_WINDOW_MS } from "../src/utils/incidents.js";

const app = createApp();

const cleanupDatabase = async () => {
  await prisma.log.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
};

const registerAndLogin = async (email: string) => {
  const response = await request(app).post("/api/v1/auth/register").send({
    name: "Test User",
    email,
    password: "password123"
  });

  return {
    token: response.body.token as string,
    user: response.body.user
  };
};

const createProject = async (token: string, name = "Demo Project") => {
  const response = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({ name });

  return response.body as { id: string; name: string };
};

const generateApiKey = async (token: string, projectId: string) => {
  const response = await request(app)
    .post(`/api/v1/projects/${projectId}/api-keys`)
    .set("Authorization", `Bearer ${token}`)
    .send();

  return response.body as { apiKey: string; credential: { id: string } };
};

const createProjectWithApiKey = async (token: string, name?: string) => {
  const project = await createProject(token, name);
  const { apiKey } = await generateApiKey(token, project.id);

  return { project, apiKey };
};

const ingestLog = async (apiKey: string, body: Record<string, unknown>) =>
  request(app).post("/api/v1/logs/ingest").set("x-api-key", apiKey).send(body);

const setIncidentTimestamps = async (incidentId: string, firstOccurrenceAt: Date, lastOccurrenceAt: Date) => {
  await prisma.incident.update({
    where: { id: incidentId },
    data: {
      firstOccurrenceAt,
      lastOccurrenceAt
    }
  });
};

describe("Freelance Log API", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  it("registers and logs in a user", async () => {
    const registerResponse = await request(app).post("/api/v1/auth/register").send({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "password123"
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.token).toEqual(expect.any(String));
    expect(registerResponse.body.user.email).toBe("ada@example.com");

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: "ada@example.com",
      password: "password123"
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toEqual(expect.any(String));
  });

  it("prevents user A from accessing user B project", async () => {
    const userA = await registerAndLogin("a@example.com");
    const userB = await registerAndLogin("b@example.com");
    const projectB = await createProject(userB.token, "Private Project");

    const response = await request(app)
      .get(`/api/v1/projects/${projectB.id}`)
      .set("Authorization", `Bearer ${userA.token}`);

    expect(response.status).toBe(403);
  });

  it("allows a valid API key to send a log", async () => {
    const user = await registerAndLogin("logs@example.com");
    const { project, apiKey } = await createProjectWithApiKey(user.token);

    const response = await ingestLog(apiKey, {
      level: "INFO",
      message: "App started",
      source: "api",
      environment: "production",
      version: "1.4.3"
    });

    expect(response.status).toBe(201);
    expect(response.body.projectId).toBe(project.id);
    expect(response.body.version).toBe("1.4.3");
  });

  it("rejects a revoked API key", async () => {
    const user = await registerAndLogin("revoked@example.com");
    const project = await createProject(user.token);
    const { apiKey, credential } = await generateApiKey(user.token, project.id);

    await request(app)
      .patch(`/api/v1/projects/${project.id}/api-keys/${credential.id}/revoke`)
      .set("Authorization", `Bearer ${user.token}`)
      .send()
      .expect(200);

    const response = await ingestLog(apiKey, { level: "INFO", message: "Should fail" });

    expect(response.status).toBe(401);
  });

  it("keeps V1 compatibility for logs without environment and version", async () => {
    const user = await registerAndLogin("incident@example.com");
    const { apiKey } = await createProjectWithApiKey(user.token);

    const response = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Database connection failed",
      source: "database"
    });

    expect(response.status).toBe(201);
    expect(response.body.incidentId).toEqual(expect.any(String));
    expect(response.body.environment).toBeNull();
    expect(response.body.version).toBeNull();

    const incidents = await request(app)
      .get("/api/v1/incidents")
      .set("Authorization", `Bearer ${user.token}`);

    expect(incidents.body.items).toHaveLength(1);
    expect(incidents.body.items[0].occurrenceCount).toBe(1);
    expect(incidents.body.items[0].firstSeen).toEqual(expect.any(String));
    expect(incidents.body.items[0].lastSeen).toEqual(expect.any(String));
  });

  it("groups equivalent ERROR logs in the same incident within the time window", async () => {
    const user = await registerAndLogin("group@example.com");
    const { apiKey } = await createProjectWithApiKey(user.token);

    const first = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Database timeout",
      source: "database",
      environment: "production",
      version: "1.4.3",
      errorCode: "DB_TIMEOUT"
    });

    const second = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Database timeout",
      source: "database",
      environment: "production",
      version: "1.4.3",
      errorCode: "DB_TIMEOUT"
    });

    expect(first.body.incidentId).toBe(second.body.incidentId);

    const incident = await prisma.incident.findUniqueOrThrow({
      where: { id: first.body.incidentId }
    });

    expect(incident.occurrenceCount).toBe(2);
  });

  it("preserves firstSeen and updates lastSeen when reusing an incident", async () => {
    const user = await registerAndLogin("times@example.com");
    const { apiKey } = await createProjectWithApiKey(user.token);

    const first = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Background job failed",
      source: "worker",
      environment: "production",
      version: "2.0.0"
    });

    const seededFirstSeen = new Date(Date.now() - 90 * 60 * 1000);
    const seededLastSeen = new Date(Date.now() - 30 * 60 * 1000);
    await setIncidentTimestamps(first.body.incidentId, seededFirstSeen, seededLastSeen);

    await ingestLog(apiKey, {
      level: "ERROR",
      message: "Background job failed",
      source: "worker",
      environment: "production",
      version: "2.0.0"
    });

    const incident = await prisma.incident.findUniqueOrThrow({
      where: { id: first.body.incidentId }
    });

    expect(incident.firstOccurrenceAt.toISOString()).toBe(seededFirstSeen.toISOString());
    expect(incident.lastOccurrenceAt.getTime()).toBeGreaterThan(seededLastSeen.getTime());
    expect(incident.occurrenceCount).toBe(2);
  });

  it("creates a new incident when the same error reappears outside the 2 hour window", async () => {
    const user = await registerAndLogin("window@example.com");
    const { apiKey } = await createProjectWithApiKey(user.token);

    const first = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Cache unavailable",
      source: "cache",
      environment: "production",
      version: "1.0.0"
    });

    const oldTimestamp = new Date(Date.now() - INCIDENT_WINDOW_MS - 60_000);
    await setIncidentTimestamps(first.body.incidentId, oldTimestamp, oldTimestamp);

    const second = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Cache unavailable",
      source: "cache",
      environment: "production",
      version: "1.0.0"
    });

    expect(second.body.incidentId).not.toBe(first.body.incidentId);

    const incidents = await prisma.incident.findMany({
      orderBy: { createdAt: "asc" }
    });

    expect(incidents).toHaveLength(2);
    expect(incidents[0].status).toBe("RESOLVED");
    expect(incidents[1].status).toBe("OPEN");
  });

  it("creates different incidents when environment changes", async () => {
    const user = await registerAndLogin("environment@example.com");
    const { apiKey } = await createProjectWithApiKey(user.token);

    const production = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Database timeout",
      source: "database",
      environment: "production",
      version: "1.4.3",
      errorCode: "DB_TIMEOUT"
    });

    const staging = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Database timeout",
      source: "database",
      environment: "staging",
      version: "1.4.3",
      errorCode: "DB_TIMEOUT"
    });

    expect(production.body.incidentId).not.toBe(staging.body.incidentId);
  });

  it("creates different incidents when version changes", async () => {
    const user = await registerAndLogin("version@example.com");
    const { apiKey } = await createProjectWithApiKey(user.token);

    const first = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Database timeout",
      source: "database",
      environment: "production",
      version: "1.4.2",
      errorCode: "DB_TIMEOUT"
    });

    const second = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Database timeout",
      source: "database",
      environment: "production",
      version: "1.4.3",
      errorCode: "DB_TIMEOUT"
    });

    expect(first.body.incidentId).not.toBe(second.body.incidentId);
  });

  it("never shares an incident between different projects", async () => {
    const user = await registerAndLogin("projects@example.com");
    const firstProject = await createProjectWithApiKey(user.token, "Project One");
    const secondProject = await createProjectWithApiKey(user.token, "Project Two");

    const first = await ingestLog(firstProject.apiKey, {
      level: "ERROR",
      message: "Payment failed",
      source: "billing",
      environment: "production",
      version: "3.1.0"
    });

    const second = await ingestLog(secondProject.apiKey, {
      level: "ERROR",
      message: "Payment failed",
      source: "billing",
      environment: "production",
      version: "3.1.0"
    });

    expect(first.body.incidentId).not.toBe(second.body.incidentId);
    expect(await prisma.incident.count()).toBe(2);
  });

  it("handles missing environment and version deterministically", async () => {
    const user = await registerAndLogin("deterministic@example.com");
    const { apiKey } = await createProjectWithApiKey(user.token);

    const first = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Webhook failed",
      source: "integrations"
    });

    const second = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Webhook failed",
      source: "integrations"
    });

    const third = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Webhook failed",
      source: "integrations",
      environment: "production"
    });

    const fourth = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Webhook failed",
      source: "integrations",
      version: "1.4.3"
    });

    expect(first.body.incidentId).toBe(second.body.incidentId);
    expect(first.body.incidentId).not.toBe(third.body.incidentId);
    expect(first.body.incidentId).not.toBe(fourth.body.incidentId);
    expect(await prisma.incident.count()).toBe(3);
  });

  it("treats changes in source and level as different incidents", async () => {
    const user = await registerAndLogin("grouping@example.com");
    const { apiKey } = await createProjectWithApiKey(user.token);

    const bySource = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Timeout while syncing",
      source: "jobs",
      environment: "production",
      version: "1.0.0"
    });

    const differentSource = await ingestLog(apiKey, {
      level: "ERROR",
      message: "Timeout while syncing",
      source: "api",
      environment: "production",
      version: "1.0.0"
    });

    const differentLevel = await ingestLog(apiKey, {
      level: "CRITICAL",
      message: "Timeout while syncing",
      source: "jobs",
      environment: "production",
      version: "1.0.0"
    });

    expect(bySource.body.incidentId).not.toBe(differentSource.body.incidentId);
    expect(bySource.body.incidentId).not.toBe(differentLevel.body.incidentId);
  });

  it("filters logs by project, level, source and environment", async () => {
    const user = await registerAndLogin("filters@example.com");
    const { project, apiKey } = await createProjectWithApiKey(user.token);

    await ingestLog(apiKey, {
      level: "INFO",
      message: "Ignored",
      source: "web",
      environment: "production"
    });

    await ingestLog(apiKey, {
      level: "ERROR",
      message: "Selected",
      source: "api",
      environment: "staging"
    });

    const response = await request(app)
      .get(`/api/v1/logs?projectId=${project.id}&level=ERROR&source=api&environment=staging&page=1&pageSize=10`)
      .set("Authorization", `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].message).toBe("Selected");
  });
});
