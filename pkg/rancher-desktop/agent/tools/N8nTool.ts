import { BaseTool, ToolContext } from './BaseTool';
import { N8nService } from '../services/N8nService';
import type { ThreadState, ToolResult } from '../types';

export class N8nTool extends BaseTool {
  override readonly name = 'n8n';
  override readonly aliases = ['automation', 'workflow', 'n8n-api'];
  private n8nService: N8nService = new N8nService();

  override getPlanningInstructions(): string {
    return `["n8n", "subcommand", "--flag", "value", ...] - Interact with n8n automation platform

Examples:
["n8n", "workflows", "list", "--active", "true", "--limit", "10"]
["n8n", "workflow", "get", "workflow-123"]
["n8n", "workflow", "create", "--name", "My Workflow", "--nodes", "[{...}]", "--connections", "{...}"]
["n8n", "workflow", "activate", "workflow-456"]
["n8n", "executions", "list", "--status", "error", "--limit", "50"]
["n8n", "credential", "create", "--name", "My API", "--type", "httpBasicAuth", "--data", "{\"user\":\"admin\",\"password\":\"secret\"}"]
["n8n", "tags", "list"]
["n8n", "variables", "list", "--projectId", "project-123"]
["n8n", "table", "rows", "get", "table-789", "--search", "john@example.com"]
["n8n", "source", "pull", "--force", "true"]
["n8n", "refresh_api_key"] // deletes and creates a new one in case you run into errors with the api key/authorization

`.trim();
  }

  async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) return helpResult;

    const args = this.getArgsArray(context);
    if (args.length < 1) {
      return { toolName: this.name, success: false, error: 'Missing subcommand' };
    }

    const subcommand = args[0].toLowerCase();
    const rest = args.slice(1);
    const params = this.argsToObject(rest);

    try {
      await this.n8nService.initialize();

      switch (subcommand) {
        // WORKFLOWS
        case 'workflows':
          if (rest[0] === 'list') {
            return { toolName: this.name, success: true, result: await this.n8nService.getWorkflows(params) };
          }
          break;

        case 'workflow':
          const id = rest[1];
          if (rest[0] === 'get') {
            return { toolName: this.name, success: true, result: await this.n8nService.getWorkflow(id, params.excludePinnedData) };
          }
          if (rest[0] === 'create') {
            return { toolName: this.name, success: true, result: await this.n8nService.createWorkflow(params as {
              name: string;
              nodes: any[];
              connections: any;
              settings: {
                saveExecutionProgress?: boolean;
                saveManualExecutions?: boolean;
                saveDataErrorExecution?: string;
                saveDataSuccessExecution?: string;
                executionTimeout?: number;
                errorWorkflow?: string;
                timezone?: string;
                executionOrder?: string;
                callerPolicy?: string;
                callerIds?: string;
                timeSavedPerExecution?: number;
                availableInMCP?: boolean;
              };
              shared?: any[];
              staticData?: any;
            }) };
          }
          if (rest[0] === 'update') {
            return { toolName: this.name, success: true, result: await this.n8nService.updateWorkflow(id, params as {
              name: string;
              nodes: any[];
              connections: any;
              settings: {
                saveExecutionProgress?: boolean;
                saveManualExecutions?: boolean;
                saveDataErrorExecution?: string;
                saveDataSuccessExecution?: string;
                executionTimeout?: number;
                errorWorkflow?: string;
                timezone?: string;
                executionOrder?: string;
                callerPolicy?: string;
                callerIds?: string;
                timeSavedPerExecution?: number;
                availableInMCP?: boolean;
              };
              shared?: any[];
              staticData?: any;
            }) };
          }
          if (rest[0] === 'delete') {
            await this.n8nService.deleteWorkflow(id);
            return { toolName: this.name, success: true, result: { deleted: true } };
          }
          if (rest[0] === 'activate') {
            return { toolName: this.name, success: true, result: await this.n8nService.activateWorkflow(id) };
          }
          break;

        // EXECUTIONS
        case 'executions':
          if (rest[0] === 'list') {
            return { toolName: this.name, success: true, result: await this.n8nService.getExecutions(params) };
          }
          break;

        case 'execution':
          if (rest[0] === 'retry') {
            const execId = rest[1];
            return { toolName: this.name, success: true, result: await this.n8nService.retryExecution(execId, params.loadWorkflow as boolean | undefined) };
          }
          break;

        // CREDENTIALS
        case 'credentials':
          if (rest[0] === 'list') {
            return { toolName: this.name, success: true, result: await this.n8nService.getCredentials(params) };
          }
          break;

        case 'credential':
          const credId = rest[1];
          if (rest[0] === 'get') {
            return { toolName: this.name, success: true, result: await this.n8nService.getCredential(credId) };
          }
          if (rest[0] === 'create') {
            return { toolName: this.name, success: true, result: await this.n8nService.createCredential(params as {
              name: string;
              type: string;
              data: any;
              isResolvable?: boolean;
            }) };
          }
          if (rest[0] === 'update') {
            return { toolName: this.name, success: true, result: await this.n8nService.updateCredential(credId, params as {
              name?: string;
              type?: string;
              data?: any;
              isGlobal?: boolean;
              isResolvable?: boolean;
              isPartialData?: boolean;
            }) };
          }
          if (rest[0] === 'delete') {
            await this.n8nService.deleteCredential(credId);
            return { toolName: this.name, success: true, result: { deleted: true } };
          }
          if (rest[0] === 'schema') {
            return { toolName: this.name, success: true, result: await this.n8nService.getCredentialSchema(rest[1]) };
          }
          break;

        // TAGS
        case 'tags':
          if (rest[0] === 'list') {
            return { toolName: this.name, success: true, result: await this.n8nService.getTags() };
          }
          break;

        // VARIABLES
        case 'variables':
          if (rest[0] === 'list') {
            return { toolName: this.name, success: true, result: await this.n8nService.getVariables(params) };
          }
          break;

        // TABLES (DATA TABLE)
        case 'tables':
          if (rest[0] === 'list') {
            return { toolName: this.name, success: true, result: await this.n8nService.getDataTables(params) };
          }
          break;

        case 'table':
          const tableId = rest[1];
          if (rest[0] === 'get') {
            return { toolName: this.name, success: true, result: await this.n8nService.getDataTable(tableId) };
          }
          if (rest[0] === 'rows' && rest[2] === 'get') {
            return { toolName: this.name, success: true, result: await this.n8nService.getDataTableRows(tableId, params) };
          }
          // Add other table actions similarly if needed
          break;

        // SOURCE CONTROL
        case 'source':
          if (rest[0] === 'pull') {
            return { toolName: this.name, success: true, result: await this.n8nService.pullFromSourceControl(params) };
          }
          break;

        case 'refresh_api_key':
          return { toolName: this.name, success: true, result: await this.n8nService.refreshApiKey() };

        default:
          return { toolName: this.name, success: false, error: `Unknown subcommand: ${subcommand}` };
      }

      throw new Error(`Invalid n8n command format`);
    } catch (err: any) {
      return {
        toolName: this.name,
        success: false,
        error: err.message || String(err)
      };
    }
  }
}