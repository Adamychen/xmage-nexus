#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerStackTools } from './tools/stack.ts'
import { registerTestTools } from './tools/tests.ts'
import { closeAllSessions, registerSessionTools } from './xmage/session.ts'
import { registerResources } from './resources.ts'

const server = new McpServer({ name: 'mage-nexus', version: '0.2.0' })

registerStackTools(server)
registerTestTools(server)
registerSessionTools(server)
registerResources(server)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[mage-mcp] ready on stdio')

let stopping = false
function shutdown(): void {
  if (stopping) return
  stopping = true
  closeAllSessions()
  setTimeout(() => process.exit(0), 500)
}
process.stdin.once('end', shutdown)
process.stdin.once('close', shutdown)
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
