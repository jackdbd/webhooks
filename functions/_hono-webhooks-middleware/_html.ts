import { Emoji } from './_constants.js'

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
