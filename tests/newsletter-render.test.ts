import { describe, expect, it } from "vitest";

import {
  NEWSLETTER_UNSUBSCRIBE_TAG,
  newsletterApprovalHash,
  prepareNewsletterArtifact,
  renderNewsletterEmail,
} from "@/lib/newsletter";
import { makeDailyBrief } from "@/tests/daily-fixtures";

describe("deterministic Daily newsletter rendering", () => {
  it("renders the complete reviewed snapshot with sources, My Take, compliance, and web link", () => {
    const brief = makeDailyBrief();
    const input = {
      brief,
      siteUrl: "https://engineerious.com/",
      postalAddress: "123 Proof Loop\nAustin, TX 78701",
    };

    const first = renderNewsletterEmail(input);
    const second = renderNewsletterEmail(input);

    expect(first).toBe(second);
    expect(first).toContain(brief.stories[0].headline);
    expect(first).toContain(brief.oneThingToLearn!.title);
    expect(first).toContain(brief.modelToKnow!.name);
    expect(first).toContain(brief.paperWorthKnowing!.title);
    expect(first).toContain(brief.myTake);
    expect(first).toContain("https://example.com/announcement");
    expect(first).toContain("https://engineerious.com/daily/2026-08-25");
    expect(first).toContain("123 Proof Loop<br>Austin, TX 78701");
    expect(first).toContain(NEWSLETTER_UNSUBSCRIBE_TAG);
  });

  it("escapes every reviewed text and attribute without escaping the provider merge tag", () => {
    const brief = makeDailyBrief({
      title: '<img src=x onerror="alert(1)"> {{{contact.email}}}',
      myTake: "Tharun's <script>alert(1)</script> {{contact.first_name}} take",
      stories: [
        {
          ...makeDailyBrief().stories[0],
          headline: "A & B < C",
          sourceUrls: ["https://example.com/source/{{{contact.email}}}?a=1&b=2"],
        },
      ],
    });
    const html = renderNewsletterEmail({
      brief,
      siteUrl: "https://engineerious.com",
      postalAddress: "PO Box 1 <Austin> {{contact.email}}",
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B &lt; C");
    expect(html).toContain("?a=1&amp;b=2");
    expect(html).toContain("PO Box 1 &lt;Austin&gt;");
    expect(html).toContain(NEWSLETTER_UNSUBSCRIBE_TAG);
    expect(html.replace(NEWSLETTER_UNSUBSCRIBE_TAG, "")).not.toMatch(/{{|}}/);
    expect(html).toContain("&#123;&#123;&#123;contact.email&#125;&#125;&#125;");
  });

  it("binds approval to the exact normalized subject and deterministic HTML", () => {
    const artifact = prepareNewsletterArtifact({
      brief: makeDailyBrief(),
      siteUrl: "https://engineerious.com",
      postalAddress: "PO Box 1, Austin, TX",
      subject: "  Engineerious\nDaily  ",
    });

    expect(artifact.subject).toBe("Engineerious Daily");
    expect(artifact.approvalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(newsletterApprovalHash({ subject: artifact.subject, html: artifact.html })).toBe(
      artifact.approvalHash,
    );
    expect(
      newsletterApprovalHash({ subject: `${artifact.subject}!`, html: artifact.html }),
    ).not.toBe(artifact.approvalHash);
    expect(() => newsletterApprovalHash({ subject: artifact.subject, html: "<p>No opt out</p>" })).toThrow(
      /unsubscribe/i,
    );
    expect(() =>
      newsletterApprovalHash({
        subject: artifact.subject,
        html: `${artifact.html}<p>{{{contact.email}}}</p>`,
      }),
    ).toThrow(/no other provider templates/i);
    expect(() =>
      prepareNewsletterArtifact({
        brief: makeDailyBrief(),
        siteUrl: "https://engineerious.com",
        postalAddress: "PO Box 1, Austin, TX",
        subject: "Daily {{{contact.email}}}",
      }),
    ).toThrow(/template delimiters/i);
  });

  it("fails closed without a valid published snapshot or postal address", () => {
    expect(() =>
      renderNewsletterEmail({
        brief: { ...makeDailyBrief(), myTake: "" },
        siteUrl: "https://engineerious.com",
        postalAddress: "PO Box 1",
      }),
    ).toThrow(/schema validation/i);
    expect(() =>
      renderNewsletterEmail({
        brief: makeDailyBrief(),
        siteUrl: "https://engineerious.com",
        postalAddress: "",
      }),
    ).toThrow();
  });
});
