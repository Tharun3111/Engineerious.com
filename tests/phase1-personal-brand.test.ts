import { describe, expect, it } from "vitest";

import { CURRENT_DESK_KINDS, currentDesk } from "@/lib/current-desk";
import { featuredProjects, getProject, projects } from "@/lib/projects";

describe("phase 1 personal brand data", () => {
  it("publishes only the repository-backed Engineerious project", () => {
    expect(projects.map((project) => project.slug)).toEqual(["engineerious"]);
    expect(featuredProjects.map((project) => project.slug)).toEqual(["engineerious"]);
    expect(getProject("engineerious")).toMatchObject({
      title: "Engineerious",
      status: "In development",
      role: "Personal AI engineering project",
    });
    expect(getProject("unpublished-example")).toBeUndefined();
  });

  it("keeps project slugs unique and case studies substantial", () => {
    const slugs = projects.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const project of projects) {
      expect(project.architecture.length).toBeGreaterThanOrEqual(4);
      expect(project.decisions.length).toBeGreaterThanOrEqual(3);
      expect(project.technologies.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("keeps unconfirmed current-desk examples explicitly unpublished", () => {
    expect(currentDesk.map((entry) => entry.kind)).toEqual(CURRENT_DESK_KINDS);
    expect(currentDesk.filter((entry) => entry.availability === "confirmed")).toEqual([
      expect.objectContaining({ kind: "building", title: "Engineerious" }),
    ]);

    for (const entry of currentDesk.filter((item) => item.kind !== "building")) {
      expect(entry.availability).toBe("not_published");
      expect(entry.title).toBe("Not published yet");
      expect("href" in entry).toBe(false);
    }
  });
});
