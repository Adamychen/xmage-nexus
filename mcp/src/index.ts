#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerStackTools } from './tools/stack.ts'
import { registerTestTools } from './tools/tests.ts'
import { registerSessionTools } from './xmage/session.ts'
import { registerResources } from './resources.ts'

const server = new McpServer({ name: 'mage-nexus', version: '0.1.0' })

registerStackTools(server)
registerTestTools(server)
registerSessionTools(server)
registerResources(server)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[mage-mcp] ready on stdio')
