# SEO Scout playbook

1. Review the extracted facts first: title, meta description, canonical, robots, language, viewport, Open Graph, headings, JSON-LD types, image alt coverage, scripts and robots.txt/sitemap presence.
2. Check each against current best practice and note what is missing, duplicated, too long or too short.
3. Assess Core Web Vitals risks from markup only (render-blocking resources, images without dimensions, lazy-loading, font loading) and label them as hints.
4. Output Markdown starting with `Score: <0-100>/100`, then a findings table, then fixes ranked by impact with exact HTML to paste.
5. End with what could not be checked without a browser or analytics.
