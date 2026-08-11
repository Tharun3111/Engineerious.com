# Daily Codex editorial task

This workflow uses Codex sign-in, web research, and project-scoped subagents. It does
not call the OpenAI API and does not require a new model API key.

## Recommended schedule

- Cadence: daily at 7:30 AM America/Chicago
- Environment: this local Git project
- Isolation: a new worktree for each run
- Permission mode: workspace write with network access
- Delivery: a new Scheduled run for review

The computer must be on and the ChatGPT desktop app must be running when the task
needs this local repository.

## Scheduled task prompt

```text
Run the Engineerious daily editorial desk in this repository.

1. Spawn the project agent named editorial_aggregator. Ask it to research important
   AI engineering news, model releases, papers, tools, and production incidents from
   the last 48 hours using primary sources. It must return at most five ranked
   candidates with URLs, dates, reported facts, engineering impact, and unknowns.
2. Check content/research and content/blog for duplicate topics.
3. Pick one candidate only if it gives working AI engineers a useful decision,
   evaluation plan, or operational lesson. If nothing clears that bar, save the
   research brief and do not force a blog draft.
4. Save the sourced research brief under content/research/YYYY-MM-DD-topic.md.
5. When a candidate clears the bar, write one MDX draft under content/blog using one
   of these formats: Model Change Brief, Research-to-Practice Note, Production
   Incident Breakdown, or Engineering Decision Guide.
6. Set draft: true, origin: ai_generated, testedStatus: not_tested, and
   authenticityStatus: pending. Never add reviewedBy or reviewedAt. Never write as
   Tharun, invent personal experience, or imply Engineerious ran a test it did not run.
7. Spawn editorial_reviewer to review the research brief and draft. Apply only fixes
   supported by its evidence findings. Leave unresolved claims out.
8. Run npm run typecheck, npm run lint, npm test, and npm run build.
9. Return the selected topic, source list, reviewer score, files changed, validation
   results, and the exact questions Tharun must answer before publication.

Do not mark a post verified, commit, push, deploy, send a newsletter, or publish to a
social network. The output is a reviewable draft, not published content.
```

## Human publication gate

Tharun reviews the draft, replaces or approves any personal judgment, verifies every
claim, and decides whether the piece represents his view. Only then may the frontmatter
change to `draft: false` and `authenticityStatus: verified` with `reviewedBy` and
`reviewedAt` recorded.

