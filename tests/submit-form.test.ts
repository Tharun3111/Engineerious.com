// @vitest-environment jsdom

import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SubmitForm } from "@/components/SubmitForm";

afterEach(cleanup);

describe("public submission form", () => {
  it("includes an accessibility-inert honeypot outside the tab order", () => {
    const { container } = render(React.createElement(SubmitForm));
    const honeypot = container.querySelector<HTMLInputElement>('input[name="company"]');
    expect(honeypot).toBeTruthy();
    expect(honeypot?.value).toBe("");
    expect(honeypot?.tabIndex).toBe(-1);
    expect(honeypot?.closest("[aria-hidden='true']")).toBeTruthy();
  });
});
