import { describe, expect, it } from "vitest";
import {
  buildRagQueryText,
  buildRetrievedContextBlock,
} from "@/lib/roast/prompts";

describe("buildRagQueryText", () => {
  it("combines roast level, job excerpt, and resume prefix with length caps", () => {
    const job = "x".repeat(2000);
    const resume = "y".repeat(3009);
    const q = buildRagQueryText({
      roastLevel: "spicy",
      jobDescription: job,
      resumePrefix: resume,
    });
    expect(q.startsWith("Roast level: spicy.")).toBe(true);
    expect(q).toContain("Job context:");
    expect(q).toContain("Resume excerpt:");
    const jobPart =
      q.split("Job context: ")[1]?.split(". Resume excerpt:")[0] ?? "";
    const resumePart = q.split("Resume excerpt: ")[1] ?? "";
    expect(jobPart.length).toBeLessThanOrEqual(1500);
    expect(resumePart.length).toBeLessThanOrEqual(2000);
  });
});

describe("buildRetrievedContextBlock", () => {
  it("returns empty string when no chunks", () => {
    expect(buildRetrievedContextBlock([])).toBe("");
  });

  it("formats non-empty chunks with headings and body", () => {
    const block = buildRetrievedContextBlock([
      { title: "T1", body: "B1", kind: "few_shot" },
      { title: "T2", body: "B2", kind: "corpus" },
    ]);
    expect(block).toContain("RETRIEVED_GUIDANCE");
    expect(block).toContain("### 1. [few_shot] T1");
    expect(block).toContain("B1");
    expect(block).toContain("### 2. [corpus] T2");
    expect(block).toContain("B2");
  });
});
