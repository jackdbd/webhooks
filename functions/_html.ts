import { Emoji } from './_utils'

const CSS = `
.inline-code {
  background-color:lightgray;
  display: inline;
  font-family: monospace;
  padding: 0.15em;
}`

export const head = () => {
  return `
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css">
  <style>${CSS}</style>
</head>`
}

interface Config {
  title: string
  instructions?: string
  successes?: string[]
  failures?: string[]
  warnings?: string[]
}

export const body = ({
  title,
  instructions = undefined,
  successes = [],
  failures = [],
  warnings = []
}: Config) => {
  let arr = [`<h1>${title}</h1>`]
  if (instructions) {
    arr.push(`<p>${instructions}</p>`)
  }
  if (successes.length > 0) {
    arr.push(...successes.map((s) => `<p>${Emoji.Success} ${s}</p>`))
  }
  if (failures.length > 0) {
    arr.push(...failures.map((s) => `<p>${Emoji.Failure} ${s}</p>`))
  }
  if (warnings.length > 0) {
    arr.push(...warnings.map((s) => `<p>${Emoji.Warning} ${s}</p>`))
  }
  arr.push(`<p>Back to <a href="/">home</a>.</p>`)

  return `<body>${arr.join('')}</body>`
}

export const anchor = ({ href, text }: { href: string; text: string }) =>
  `<a href="${href}" rel="noopener noreferrer" target="_blank">${text}</a>`

export const notFoundPage = (request_path: string) => {
  return `
<!DOCTYPE html>
<html lang="en">
  ${head()}
  ${body({
    title: `Not Found ${request_path}`
  })}
</html>`
}

export const errorPage = () => {
  return `
<!DOCTYPE html>
<html lang="en">
  ${head()}
  ${body({
    title: `Ops. There was an error!`
  })}
</html>`
}
