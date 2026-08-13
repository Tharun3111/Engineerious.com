/**
 * Renders a structured-data script tag. `<` is escaped to `<` — the payload
 * can contain post titles/deks sourced from LLM output, and an unescaped `</script>`
 * inside the JSON string would terminate the tag early and inject raw HTML.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
