import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

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

  return response.body;
};

const generateApiKey = async (token: string, projectId: string) => {
  const response = await request(app)
    .post(`/api/v1/projects/${projectId}/api-keys`)
    .set("Authorization", `Bearer ${token}`)
    .send();

  return response.body as { apiKey: string; credential: { id: string } };
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
    const project = await createProject(user.token);
    const { apiKey } = await generateApiKey(user.token, project.id);

    const response = await request(app)
      .post("/api/v1/logs/ingest")
      .set("x-api-key", apiKey)
      .send({
        level: "INFO",
        message: "App started",
        source: "api",
        environment: "production"
      });

    expect(response.status).toBe(201);
    expect(response.body.projectId).toBe(project.id);
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

    const response = await request(app)
      .post("/api/v1/logs/ingest")
      .set("x-api-key", apiKey)
      .send({ level: "INFO", message: "Should fail" });

    expect(response.status).toBe(401);
  });

  it("creates an incident for ERROR logs", async () => {
    const user = await registerAndLogin("incident@example.com");
    const project = await createProject(user.token);
    const { apiKey } = await generateApiKey(user.token, project.id);

    const response = await request(app)
      .post("/api/v1/logs/ingest")
      .set("x-api-key", apiKey)
      .send({ level: "ERROR", message: "User 15 not found", errorCode: "USER_NOT_FOUND" });

    expect(response.status).toBe(201);
    expect(response.body.incidentId).toEqual(expect.any(String));

    const incidents = await request(app)
      .get("/api/v1/incidents")
      .set("Authorization", `Bearer ${user.token}`);

    expect(incidents.body.items).toHaveLength(1);
    expect(incidents.body.items[0].occurrenceCount).toBe(1);
  });

  it("groups related ERROR logs in the same incident within the time window", async () => {
    const user = await registerAndLogin("group@example.com");
    const project = await createProject(user.token);
    const { apiKey } = await generateApiKey(user.token, project.id);

    const first = await request(app)
      .post("/api/v1/logs/ingest")
      .set("x-api-key", apiKey)
      .send({ level: "ERROR", message: "User 15 not found", errorCode: "USER_NOT_FOUND" });

    const second = await request(app)
      .post("/api/v1/logs/ingest")
      .set("x-api-key", apiKey)
      .send({ level: "ERROR", message: "User 27 not found", errorCode: "USER_NOT_FOUND" });

    expect(first.body.incidentId).toBe(second.body.incidentId);

    const incident = await prisma.incident.findUniqueOrThrow({
      where: { id: first.body.incidentId }
    });

    expect(incident.occurrenceCount).toBe(2);
  });

  it("does not group different errors incorrectly", async () => {
    const user = await registerAndLogin("distinct@example.com");
    const project = await createProject(user.token);
    const { apiKey } = await generateApiKey(user.token, project.id);

    const first = await request(app)
      .post("/api/v1/logs/ingest")
      .set("x-api-key", apiKey)
      .send({ level: "ERROR", message: "User not found", errorCode: "USER_NOT_FOUND" });

    const second = await request(app)
      .post("/api/v1/logs/ingest")
      .set("x-api-key", apiKey)
      .send({ level: "ERROR", message: "Payment failed", errorCode: "PAYMENT_FAILED" });

    expect(first.body.incidentId).not.toBe(second.body.incidentId);
    expect(await prisma.incident.count()).toBe(2);
  });

  it("filters logs by project, level, source and environment", async () => {
    const user = await registerAndLogin("filters@example.com");
    const project = await createProject(user.token);
    const { apiKey } = await generateApiKey(user.token, project.id);

    await request(app)
      .post("/api/v1/logs/ingest")
      .set("x-api-key", apiKey)
      .send({ level: "INFO", message: "Ignored", source: "web", environment: "production" });

    await request(app)
      .post("/api/v1/logs/ingest")
      .set("x-api-key", apiKey)
      .send({ level: "ERROR", message: "Selected", source: "api", environment: "staging" });

    const response = await request(app)
      .get(`/api/v1/logs?projectId=${project.id}&level=ERROR&source=api&environment=staging&page=1&pageSize=10`)
      .set("Authorization", `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].message).toBe("Selected");
  });
});
