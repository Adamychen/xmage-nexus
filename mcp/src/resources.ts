import fs from 'node:fs'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { repoRoot } from './lib.ts'

function readFileOr(file: string, fallback: string): string {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return fallback
  }
}

function projectSummary(): string {
  const roadmap = readFileOr(path.join(repoRoot, 'ROADMAP.md'), '(ROADMAP.md no encontrado)')
  const lessons = readFileOr(path.join(repoRoot, 'docs', 'lessons.md'), '(docs/lessons.md no encontrado)')
  const lines = roadmap.split('\n')
  const section = (start: string, end: string): string => {
    const from = lines.findIndex((line) => line.startsWith(start))
    if (from < 0) return ''
    const to = lines.findIndex((line, index) => index > from && line.startsWith(end))
    return lines.slice(from, to > from ? to : from + 60).join('\n')
  }
  return [
    lines.slice(0, 6).join('\n'),
    section('## 2.', '## 3.'),
    section('## 4.', '## 5.'),
    '--- lecciones durables (docs/lessons.md) ---',
    lessons,
  ].join('\n\n')
}

export function registerResources(server: McpServer): void {
  server.registerResource(
    'project-status',
    'mage://status/project',
    {
      title: 'Project status',
      description: 'Estado: cabecera y estado actual de ROADMAP.md, pendientes (§4) y lecciones durables (docs/lessons.md).',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: projectSummary() }],
    }),
  )

  const jsonResources = [
    {
      name: 'dashboard-status',
      uri: 'mage://status/dashboard',
      title: 'Dashboard status',
      description: 'site/status.json — estado publicado de capas de test, cobertura y fases.',
      file: 'site/status.json',
    },
    {
      name: 'contract-schema',
      uri: 'mage://contract/schema',
      title: 'Protocol contract schema',
      description: 'web/schema/contract.schema.json — fuente de verdad del protocolo proxy↔web.',
      file: 'web/schema/contract.schema.json',
    },
    {
      name: 'fixtures-manifest',
      uri: 'mage://fixtures/manifest',
      title: 'Recorded fixtures manifest',
      description: 'web/fixtures/recorded/manifest.json — frames reales grabados e invariantes.',
      file: 'web/fixtures/recorded/manifest.json',
    },
  ] as const

  for (const entry of jsonResources) {
    server.registerResource(
      entry.name,
      entry.uri,
      { title: entry.title, description: entry.description, mimeType: 'application/json' },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: readFileOr(path.join(repoRoot, entry.file), `(no encontrado: ${entry.file})`),
          },
        ],
      }),
    )
  }

  server.registerResource(
    'interaction-coverage',
    'mage://coverage/interactions',
    {
      title: 'Interaction coverage matrix',
      description: 'web/INTERACTION_COVERAGE.md — callbacks servidor→cliente implementados y testeados.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: readFileOr(path.join(repoRoot, 'web', 'INTERACTION_COVERAGE.md'), '(no encontrado)'),
        },
      ],
    }),
  )
}
