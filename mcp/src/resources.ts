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
  const full = readFileOr(path.join(repoRoot, 'PROJECT.md'), '(PROJECT.md no encontrado)')
  const lines = full.split('\n')
  const start = lines.findIndex((line) => line.startsWith('## 2.'))
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## 3.'))
  const header = lines.slice(0, 6).join('\n')
  const status = start >= 0 ? lines.slice(start, end > start ? end : start + 40).join('\n') : ''
  const changelog = lines.slice(-40).join('\n')
  return `${header}\n\n${status}\n\n--- changelog (cola) ---\n${changelog}`
}

export function registerResources(server: McpServer): void {
  server.registerResource(
    'project-status',
    'mage://status/project',
    {
      title: 'Project status',
      description: 'Cabecera + tabla de estado de fases de PROJECT.md y cola del changelog (recortado).',
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
