export const environment = `
# Environment

## n8n
- n8n is installed locally on docker.
- The n8n dashboard is accessible at http://127.0.0.1:30119.
- n8n web UI host: localhost
- n8n web UI port: 30119
- n8n base URL: http://127.0.0.1:30119
- n8n has a full API.
- Native tools are built around the n8n API in the n8n tool category.
- n8n is installed into the postgres database.
- Native pg tools are available in the pg tool category.
- The n8n templates API is available through the native tools.
- n8n operations are stateful.
- Creating or updating workflows and credentials changes persisted data.
- Workflow payloads follow the n8n structure:
  - nodes: array of node objects
  - connections: object keyed by source node
  - settings: object

## Node-specific workflow editing tools
- patch_workflow is the unified mutation tool for node and connection deltas.
- patch_workflow applies operations sequentially and writes once in a single atomic workflow update.
- nodeId selectors are available.
- nodeName selectors are available.
- get_workflow_node_list returns a lightweight list of all nodes (id/name/type/index/position + inbound/outbound counts) and basic edge map.
- get_workflow_node returns node details by nodeId or nodeName, node index, and connection summary.
- patch_workflow supports node operations: add, update, remove.
- patch_workflow supports connection operations: add, remove.
- patch_workflow can combine multiple node + connection changes in one call.

## Active Sidebar Elements (Persona Assets)
- The right sidebar supports active elements that can show live webpages (iframe) and editable documents.
- Use tool 
  
  manage_active_asset
  
  to create/update/remove these active elements.
- For workflow SPA webpage display, use the resolved stable workflow asset ID.
- Keep URL on the workflow app main/base route only (origin), not deep workflow routes.
- Derive base route dynamically from the provided workflow URL (URL origin), not hardcoded route paths.
- Typical flow for workflow tasks:
  1) Upsert iframe asset using a workflow URL.
  2) Normalize to origin/main route and keep using the same id.
  3) Keep active=true so user can watch live changes.
- Recommended workflow URL example:
  - https://<workflow-host>:<port>

### manage_active_asset quick usage
- Upsert workflow page:
  {"action":"upsert","assetType":"iframe","assetId":"workflow_panel","skillSlug":"workflow_automation","title":"Workflow App","url":"https://workflow.example.internal/workflow/abc123","active":true,"collapsed":true}
- Upsert planning document:
  {"action":"upsert","assetType":"document","assetId":"planning-prd","title":"Planning PRD","content":"<h3>Plan</h3><p>...</p>","active":true}

## Chat Completions Endpoint
- Local chat completions are provided by Sulla's OpenAI-compatible API server at http://localhost:3000/v1/chat/completions.
- For containerized workloads the endpoint is http://host.docker.internal:3000/v1/chat/completions.
- Endpoints are prefixed with /v1/ and include /v1/models, /v1/chat/completions, /v1/completions, /v1/embeddings, and /v1/moderations.
- No authentication is required for this local API.
- The OpenAI node (n8n-nodes-langchain.openai) is configured to the local OpenAI-compatible base URL http://localhost:3000/v1.
- The HTTP Request node is available to call POST /v1/chat/completions directly.
- The chat completions request body shape includes a messages array (required) and optional fields model, temperature, max_tokens, stream:false.

## Integration Credentials
- integration_get_credentials returns connection status and stored integration form values.
- Integration credential values map to the n8n credential shape for specific node credential types.
- n8n credentials are managed through the local credentials entity store.

## n8n Credentials
The n8n credentials db table schema

- n8n credentials in this environment are managed through the local credentials entity store.
- get_credentials lists existing credentials.
- create_credential adds credentials.
- Credential type matches node requirements.

| Integration | Slug | Connected | n8n Credential ID | Credential Type | Status |
|---|---|---|---|---|---|
| {name} | {slug} | yes/no | {id or "pending"} | {type} | ready/missing/created |

## Workflows
- Workflow ID: {id or "pending"}
- Workflow name: {slug}
- Based on template: {templateId or "scratch"}
- Node list: {ordered list of node names and types}
- Connection map: {summary of node-to-node connections}

## Activation
- Status: pending / active / failed
- Activated at: {timestamp or "n/a"}
- Failure reason: {if failed}

## Testing
- Test runs: {count}
- Last result: pass/fail
- Errors encountered: {list or "none"}
- Resolution: {what was fixed}
`;