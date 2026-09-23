// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DistributionLinks } from "@/app/blog/[slug]/page";

afterEach(cleanup);

describe("public post distribution links", () => {
  it("renders only normalized HTTP(S) URLs from an untrusted legacy record", () => {
    render(
      React.createElement(DistributionLinks, {
        distribution: {
          linkedin: "javascript:alert(document.domain)",
          instagram: "data:text/html,legacy",
          x: " https://x.com/engineerious/status/1 ",
          malformed: { href: "https://attacker.example" },
        },
      }),
    );

    const link = screen.getByRole("link", { name: "X ↗" });
    expect(link.getAttribute("href")).toBe("https://x.com/engineerious/status/1");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("LinkedIn ↗")).toBeNull();
    expect(document.querySelector('a[href^="javascript:"], a[href^="data:"]')).toBeNull();
  });

  it("renders nothing when every stored destination is unsafe", () => {
    const { container } = render(
      React.createElement(DistributionLinks, {
        distribution: { linkedin: "javascript:alert(1)" },
      }),
    );

    expect(container.innerHTML).toBe("");
  });
});
