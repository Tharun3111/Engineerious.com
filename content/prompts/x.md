Turn the article below into an **X thread**.

Output the thread only, one tweet per line, numbered `1/`, `2/`, … with a blank line between tweets. No preamble.

Constraints:
- 6–10 tweets. Every tweet under 280 characters — count them.
- Tweet 1 states the finding flatly. No "🧵", no "a thread", no "let's dive in".
- Tweets 2–N each carry one technical point: a mechanism, a measurement, a tradeoff, or a thing that broke.
- At least one tweet must name what did NOT work. That is the part people quote.
- Code or config in a tweet is fine if it fits and is real.
- Final tweet links the article: `Full writeup: {{url}}`.
- No hashtags. No @-mentions of people who were not asked.

---

TITLE: {{title}}
DEK: {{dek}}
PILLAR: {{pillar}}
URL: {{url}}

ARTICLE:
{{body}}
