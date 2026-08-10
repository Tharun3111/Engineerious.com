Turn the article below into a **LinkedIn post** plus a **carousel outline**.

Format the output exactly like this, with no preamble:

```
=== POST ===
<the LinkedIn text post>

=== CAROUSEL ===
Slide 1: <headline, max 8 words> | <one supporting line>
Slide 2: ...
(6–8 slides total)
```

Post constraints:
- 150–250 words. LinkedIn truncates at ~210 characters, so the first two lines must carry the whole argument.
- Open with the specific technical claim, not a hook. No "Here's what I learned", no rhetorical questions.
- One concrete detail from the article in the first three lines (a number, a tool name, a failure mode).
- Short paragraphs, one idea each, blank line between them.
- End with a genuine question about the reader's implementation, not "What do you think?".
- 3–5 hashtags, lowercase, specific (#llmevals not #ai).
- No emoji bullets. No "🚀".

Carousel constraints:
- Slide 1 is the claim. The last slide is the takeaway plus "Full writeup: {{url}}".
- Each middle slide is one step, tradeoff, or failure mode from the article.
- Text only — describe no images.

---

TITLE: {{title}}
DEK: {{dek}}
PILLAR: {{pillar}}
URL: {{url}}

ARTICLE:
{{body}}
