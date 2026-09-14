import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  sourcePage: vi.fn(),
  excerptPage: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/services/research-service", () => ({
  researchService: {
    sources: { listPage: mocks.sourcePage, list: vi.fn() },
    excerpts: { listPage: mocks.excerptPage },
  },
}));

import { GET as getSources } from "@/app/api/sources/route";
import { GET as getExcerpts } from "@/app/api/excerpts/route";

describe("server-backed collection pagination", () => {
  beforeEach(() => {
    mocks.requireUser.mockResolvedValue({ id: "verified-user" });
    mocks.sourcePage.mockResolvedValue({ rows: [], total: 41 });
    mocks.excerptPage.mockResolvedValue({ rows: [], total: 21 });
  });

  it("passes source filters and bounds to the repository", async () => {
    const request = new NextRequest("http://localhost/api/sources?page=2&pageSize=20&q=climate&type=Report&projectId=project-1&tag=evidence&reviewOnly=true&sort=title");
    const response = await getSources(request);
    expect(response.status).toBe(200);
    expect(mocks.sourcePage).toHaveBeenCalledWith("verified-user", {
      skip: 20, take: 20, q: "climate", type: "Report", projectId: "project-1",
      tag: "evidence", reviewOnly: true, sort: "title",
    });
    await expect(response.json()).resolves.toMatchObject({ page: 2, pageCount: 3, total: 41 });
  });

  it("passes excerpt filters and bounds to the repository", async () => {
    const request = new NextRequest("http://localhost/api/excerpts?page=2&pageSize=10&q=claim&sourceId=source-1&projectId=project-1&tag=evidence&type=Evidence&sort=source");
    const response = await getExcerpts(request);
    expect(response.status).toBe(200);
    expect(mocks.excerptPage).toHaveBeenCalledWith("verified-user", {
      skip: 10, take: 10, q: "claim", sourceId: "source-1", projectId: "project-1",
      tag: "evidence", type: "Evidence", sort: "source",
    });
    await expect(response.json()).resolves.toMatchObject({ page: 2, pageCount: 3, total: 21 });
  });
});
