# content/blog

Human-authored posts live here as `.mdx`, and this directory is the source of truth
for them — `posts` in Postgres is only a mirror.

It is currently empty on purpose. The four files that used to sit here were all
`origin: ai_generated`, `draft: true`, `testedStatus: not_tested`, and three of them
claimed first-hand work nobody had done ("I reverse-engineered 45 eval metrics", "The
first eval suite I built for a production RAG assistant"). They were removed rather
than shipped.

`assertNoFabricatedExperience` in `lib/content/frontmatter.ts` now blocks that class
of post at build time: a machine draft may report and cite, but may not claim to have
done things. Drafts warn; publishing one throws.
