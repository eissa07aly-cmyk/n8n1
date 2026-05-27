import type { RuntimeSkill } from '@n8n/agents';
import { ASK_QUESTION_TOOL_NAME, McpServerConfigSchema } from '@n8n/api-types';
import type { JSONSchema7 } from 'json-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { jsonSchemaToCompactText } from '../../json-config/schema-text-serializer';

const mcpServerSchemaText = jsonSchemaToCompactText(
	zodToJsonSchema(McpServerConfigSchema) as JSONSchema7,
);

export function mcpSkill(): RuntimeSkill {
	return {
		id: 'agent-builder-mcp',
		name: 'Agent builder MCP servers',
		description:
			'Use when adding, removing, or updating MCP (Model Context Protocol) servers on the target agent.',
		instructions: `\
MCP servers expose external tool catalogs to the target agent over HTTP. They
live on the top-level \`mcpServers\` array. Each entry maps 1:1 to a connected
MCP server.

When to use MCP vs n8n tools:
- **MCP servers are preferred** for real-world integrations (e.g. GitHub,
  Slack, Notion, Linear). Always check \`search_mcp_servers\` first.
- Fall back to workflow or node tools only when no MCP server is available
  for the requested integration.

## Discovery and setup workflow

Follow these steps in order when adding an MCP server:

1. **Search:** Call \`search_mcp_servers\` with keywords matching the
   integration the user wants (e.g. \`["github"]\`, \`["slack"]\`).
   The result includes \`name\`, \`url\`, \`transport\`, \`authentication\`,
   \`credentialType\`, and a \`tools\` list for each matching server.
2. **Credential:** Call \`ask_credential\` with the \`credentialType\` from
   the search result. Never invent credential IDs.
   If the user declines, omit the server entirely.
3. **Verify:** Call \`verify_mcp_server\` with the server \`name\`, \`url\`,
   \`transport\`, \`authentication\`, and the credential id from step 2.
   On success it returns \`{ ok: true, tools: [{ name, description }] }\`.
   Use the tool list to populate \`toolFilter\` or \`approval\` fields.
   On failure, explain the error and ask the user to check URL or credentials.
4. **Write config:** Call \`read_config\`, then \`patch_config\` to add the
   server to \`mcpServers[]\` (two-step pattern below).

If \`search_mcp_servers\` returns no results and the user provides a custom
MCP server URL, skip step 1 and ask the user for URL, transport, and auth
type. Then continue from step 2.

## Selecting credentials

When the user asks for an MCP server from the registry, use the
\`credentialType\` returned by \`search_mcp_servers\` directly.

For custom MCP servers (not from registry), ask which credential type to use:
OAuth2, Bearer Token, Header Auth, Multiple Headers Auth, or None.
Use \`${ASK_QUESTION_TOOL_NAME}\` for asking. Based on response:
- \`bearerAuth\` -> \`ask_credential\` with \`credentialType: "httpBearerAuth"\`
- \`headerAuth\` -> \`ask_credential\` with \`credentialType: "httpHeaderAuth"\`
- \`multipleHeadersAuth\` -> \`ask_credential\` with
  \`credentialType: "httpMultipleHeadersAuth"\`
- \`mcpOAuth2Api\` -> \`ask_credential\` with \`credentialType: "mcpOAuth2Api"\`

## mcpServers[] entry schema

${mcpServerSchemaText}

Use \`metadata.nodeTypeName\` from \`search_mcp_servers\` result when available
(enables the correct UI form for editing).
When a server comes from \`search_mcp_servers\`, include
\`metadata: { nodeTypeName: <result.nodeTypeName> }\` in the \`mcpServers[]\`
entry. For custom/manual MCP URL setup, do NOT invent \`metadata.nodeTypeName\`;

Patch pattern (two-step):
1. Initialize the array if missing:
   \`{ "op": "add", "path": "/mcpServers", "value": [] }\`
2. Append each server:
   \`{ "op": "add", "path": "/mcpServers/-", "value": { ... } }\`

Constraints:
- Server \`name\` must be unique across \`mcpServers\` within an agent.
- \`search_nodes\` does NOT return MCP servers. Always use
  \`search_mcp_servers\` for MCP discovery.
- Never fabricate \`metadata.nodeTypeName\`. Use it only when returned by
  \`search_mcp_servers\`.`,
	};
}
