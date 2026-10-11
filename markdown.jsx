import React from 'react'

// A deliberately small Markdown renderer for provider reports. It builds React
// elements only (no HTML injection), so untrusted report text stays inert.

function inline(text, keyBase) {
  const out = []
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))|(https?:\/\/[^\s)<>\]]+)/g
  let last = 0
  let match
  let index = 0
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const key = keyBase + '-' + index++
    if (match[1]) out.push(<code key={key}>{match[1].slice(1, -1)}</code>)
    else if (match[2]) out.push(<strong key={key}>{match[2].slice(2, -2)}</strong>)
    else if (match[3]) out.push(<a key={key} href={match[4]} target="_blank" rel="noopener noreferrer">{match[3].slice(1, match[3].indexOf(']'))}</a>)
    else out.push(<a key={key} href={match[5]} target="_blank" rel="noopener noreferrer">{match[5]}</a>)
    last = pattern.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// Escaped pipes (\\|) are cell text, not column breaks.
const cells = (line) => line.trim().replace(/^\||(?<!\\)\|$/g, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'))

export function Markdown({ text }) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const key = 'b' + i
    if (/^\s*```/.test(line)) {
      const lang = line.trim().slice(3).trim()
      const body = []
      i += 1
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      i += 1
      blocks.push(<pre key={key} className="am-md-code" data-lang={lang || undefined}><code>{body.join('\n')}</code></pre>)
      continue
    }
    if (/^\s*>/.test(line)) {
      const quote = []
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push(<blockquote key={key}>{inline(quote.join(' '), key)}</blockquote>)
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const Tag = 'h' + Math.min(6, heading[1].length + 2)
      blocks.push(<Tag key={key}>{inline(heading[2], key)}</Tag>)
      i += 1
      continue
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(line)
      const rows = []
      i += 2
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]))
      blocks.push(<div key={key} className="am-md-table"><table><thead><tr>{head.map((cell, n) => <th key={n}>{inline(cell, key + 'h' + n)}</th>)}</tr></thead><tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, n) => <td key={n}>{inline(cell, key + r + 'c' + n)}</td>)}</tr>)}</tbody></table></div>)
      continue
    }
    if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d/.test(line)
      const items = []
      while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i])) {
        const item = [lines[i].replace(/^\s*([-*]|\d+[.)])\s+/, '')]
        i += 1
        // Indented continuation lines (not code fences) belong to this item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+[.)])\s+/.test(lines[i]) && !/^\s*```/.test(lines[i])) item.push(lines[i++].trim())
        items.push(item.join(' '))
      }
      const List = ordered ? 'ol' : 'ul'
      blocks.push(<List key={key}>{items.map((item, n) => <li key={n}>{inline(item, key + 'l' + n)}</li>)}</List>)
      continue
    }
    if (!line.trim() || /^\s*(-{3,}|\*{3,})\s*$/.test(line)) { i += 1; continue }
    const para = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*```|\s*\||\s*>|\s*([-*]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++])
    if (!para.length) { para.push(line); i += 1 }
    blocks.push(<p key={key}>{inline(para.join(' '), key)}</p>)
  }
  return <div className="am-md">{blocks}</div>
}

// The text under a "## <title>" heading, up to the next heading of that level.
export function section(text, title) {
  const lines = String(text || '').split('\n')
  // Headings may be numbered ("## 4. GitHub-issue exports").
  const pattern = new RegExp('^(#{1,3})\\s+(?:\\d+[.)]\\s*)?' + title + '\\b', 'i')
  const start = lines.findIndex((line) => pattern.test(line.trim()))
  if (start < 0) return ''
  const level = pattern.exec(lines[start].trim())[1].length
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => { const m = /^(#{1,6})\s+/.exec(line.trim()); return m && m[1].length <= level })
  return rest.slice(0, end < 0 ? undefined : end).join('\n').trim()
}
