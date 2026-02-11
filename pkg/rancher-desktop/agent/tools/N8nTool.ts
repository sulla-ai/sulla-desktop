import { BaseTool, ToolContext } from './BaseTool';
import { N8nService } from '../services/N8nService';
import type { ThreadState, ToolResult } from '../types';

export class N8nTool extends BaseTool {
  override readonly name = 'n8n';
  override readonly aliases = ['automation', 'workflow', 'n8n-api'];

  constructor(private n8nService: N8nService) {
    super();
  }

  override getPlanningInstructions(): string {
    return `["n8n", "command", "args..."] - n8n automation platform API

WORKFLOW COMMANDS:
["n8n", "workflows", "list", {active?, tags?, name?, limit?, cursor?}]
["n8n", "workflow", "get", "workflowId", {excludePinnedData?}]
["n8n", "workflow", "create", {name, nodes, connections, settings}]
["n8n", "workflow", "update", "workflowId", {name, nodes, connections, settings}]
["n8n", "workflow", "delete", "workflowId"]
["n8n", "workflow", "activate", "workflowId", {versionId?, name?, description?}]
["n8n", "workflow", "tags", "get", "workflowId"]
["n8n", "workflow", "tags", "update", "workflowId", [{id: "tagId"}]]
["n8n", "workflow", "version", "get", "workflowId", "versionId"]

EXECUTION COMMANDS:
["n8n", "executions", "list", {status?, workflowId?, limit?, cursor?}]
["n8n", "execution", "retry", "executionId", {loadWorkflow?}]

CREDENTIAL COMMANDS:
["n8n", "credentials", "list", {limit?, cursor?}]
["n8n", "credential", "get", "credentialId"]
["n8n", "credential", "create", {name, type, data, isResolvable?}]
["n8n", "credential", "update", "credentialId", {name?, type?, data?, isGlobal?, isResolvable?, isPartialData?}]
["n8n", "credential", "delete", "credentialId"]
["n8n", "credential", "schema", "credentialType"]

TAG COMMANDS:
["n8n", "tags", "list"]
["n8n", "tag", "get", "tagId"]
["n8n", "tag", "create", {name}]
["n8n", "tag", "update", "tagId", {name}]
["n8n", "tag", "delete", "tagId"]

VARIABLE COMMANDS:
["n8n", "variables", "list", {limit?, cursor?, projectId?, state?}]
["n8n", "variable", "create", {key, value, projectId?}]
["n8n", "variable", "update", "variableId", {key, value, projectId?}]
["n8n", "variable", "delete", "variableId"]

DATA TABLE COMMANDS:
["n8n", "tables", "list", {limit?, cursor?, filter?, sortBy?}]
["n8n", "table", "get", "tableId"]
["n8n", "table", "create", {name, columns: [{name, type}]}]
["n8n", "table", "update", "tableId", {name}]
["n8n", "table", "delete", "tableId"]
["n8n", "table", "rows", "get", "tableId", {limit?, cursor?, filter?, sortBy?, search?}]
["n8n", "table", "rows", "create", "tableId", {data: [...], returnType?}]
["n8n", "table", "rows", "update", "tableId", {filter, data, returnData?, dryRun?}]
["n8n", "table", "row", "upsert", "tableId", {filter, data, returnData?, dryRun?}]
["n8n", "table", "rows", "delete", "tableId", {filter, returnData?, dryRun?}]

SOURCE CONTROL:
["n8n", "source", "pull", {force?, autoPublish?, variables?}]

SYSTEM:
["n8n", "user", "get"]
["n8n", "health", "check"]

Examples:
["n8n", "workflows", "list", {"active": true, "limit": 10}]
["n8n", "workflow", "get", "workflow-123"]
["n8n", "workflow", "activate", "workflow-456", {"versionId": "v1.2"}]
["n8n", "executions", "list", {"status": "error", "limit": 50}]
["n8n", "credentials", "list", {"limit": 25}]
["n8n", "credential", "create", {"name": "My API", "type": "httpBasicAuth", "data": {"user": "admin"}}]
["n8n", "tags", "list"]
["n8n", "variables", "list", {"projectId": "project-123"}]
["n8n", "tables", "list"]
["n8n", "table", "rows", "get", "table-789", {"search": "john@example.com"}]
["n8n", "table", "rows", "create", "table-789", {"data": [{"name": "John", "email": "john@test.com"}], "returnType": "id"}]
["n8n", "source", "pull", {"force": true, "autoPublish": "published"}]
`.trim();
  }

  async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    try {
      const args = this.getArgsArray(context);
      const result = await this.run(args);
      return {
        toolName: this.name,
        success: true,
        result
      };
    } catch (error) {
      return {
        toolName: this.name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async run(args: string[]): Promise<any> {
    const [command, subCommand, ...restArgs] = args;

    try {
      switch (command) {
        // WORKFLOW COMMANDS
        case 'workflows':
          if (subCommand === 'list') {
            const options = restArgs[0] ? JSON.parse(restArgs[0]) : {};
            return await this.n8nService.getWorkflows(options);
          }
          break;

        case 'workflow':
          if (subCommand === 'get') {
            const [workflowId, optionsStr] = restArgs;
            const options = optionsStr ? JSON.parse(optionsStr) : {};
            return await this.n8nService.getWorkflow(workflowId, options.excludePinnedData);
          } else if (subCommand === 'create') {
            const workflowData = JSON.parse(restArgs[0]);
            return await this.n8nService.createWorkflow(workflowData);
          } else if (subCommand === 'update') {
            const [workflowId, workflowDataStr] = restArgs;
            const workflowData = JSON.parse(workflowDataStr);
            return await this.n8nService.updateWorkflow(workflowId, workflowData);
          } else if (subCommand === 'delete') {
            const [workflowId] = restArgs;
            return await this.n8nService.deleteWorkflow(workflowId);
          } else if (subCommand === 'activate') {
            const [workflowId, optionsStr] = restArgs;
            const options = optionsStr ? JSON.parse(optionsStr) : {};
            return await this.n8nService.activateWorkflow(workflowId, options);
          } else if (subCommand === 'tags') {
            if (restArgs[0] === 'get') {
              const [workflowId] = restArgs.slice(1);
              return await this.n8nService.getWorkflowTags(workflowId);
            } else if (restArgs[0] === 'update') {
              const [workflowId, tagsStr] = restArgs.slice(1);
              const tags = JSON.parse(tagsStr);
              return await this.n8nService.updateWorkflowTags(workflowId, tags);
            }
          } else if (subCommand === 'version') {
            if (restArgs[0] === 'get') {
              const [workflowId, versionId] = restArgs.slice(1);
              return await this.n8nService.getWorkflowVersion(workflowId, versionId);
            }
          }
          break;

        // EXECUTION COMMANDS
        case 'executions':
          if (subCommand === 'list') {
            const options = restArgs[0] ? JSON.parse(restArgs[0]) : {};
            return await this.n8nService.getExecutions(options);
          }
          break;

        case 'execution':
          if (subCommand === 'retry') {
            const [executionId, optionsStr] = restArgs;
            const options = optionsStr ? JSON.parse(optionsStr) : {};
            return await this.n8nService.retryExecution(executionId, options);
          }
          break;

        // CREDENTIAL COMMANDS
        case 'credentials':
          if (subCommand === 'list') {
            const options = restArgs[0] ? JSON.parse(restArgs[0]) : {};
            return await this.n8nService.getCredentials(options);
          }
          break;

        case 'credential':
          if (subCommand === 'get') {
            const [credentialId] = restArgs;
            return await this.n8nService.getCredential(credentialId);
          } else if (subCommand === 'create') {
            const credentialData = JSON.parse(restArgs[0]);
            return await this.n8nService.createCredential(credentialData);
          } else if (subCommand === 'update') {
            const [credentialId, credentialDataStr] = restArgs;
            const credentialData = JSON.parse(credentialDataStr);
            return await this.n8nService.updateCredential(credentialId, credentialData);
          } else if (subCommand === 'delete') {
            const [credentialId] = restArgs;
            return await this.n8nService.deleteCredential(credentialId);
          } else if (subCommand === 'schema') {
            const [credentialType] = restArgs;
            return await this.n8nService.getCredentialSchema(credentialType);
          }
          break;

        // TAG COMMANDS
        case 'tags':
          if (subCommand === 'list') {
            return await this.n8nService.getTags();
          }
          break;

        case 'tag':
          if (subCommand === 'get') {
            const [tagId] = restArgs;
            return await this.n8nService.getTag(tagId);
          } else if (subCommand === 'create') {
            const tagData = JSON.parse(restArgs[0]);
            return await this.n8nService.createTag(tagData);
          } else if (subCommand === 'update') {
            const [tagId, tagDataStr] = restArgs;
            const tagData = JSON.parse(tagDataStr);
            return await this.n8nService.updateTag(tagId, tagData);
          } else if (subCommand === 'delete') {
            const [tagId] = restArgs;
            return await this.n8nService.deleteTag(tagId);
          }
          break;

        // VARIABLE COMMANDS
        case 'variables':
          if (subCommand === 'list') {
            const options = restArgs[0] ? JSON.parse(restArgs[0]) : {};
            return await this.n8nService.getVariables(options);
          }
          break;

        case 'variable':
          if (subCommand === 'create') {
            const variableData = JSON.parse(restArgs[0]);
            return await this.n8nService.createVariable(variableData);
          } else if (subCommand === 'update') {
            const [variableId, variableDataStr] = restArgs;
            const variableData = JSON.parse(variableDataStr);
            return await this.n8nService.updateVariable(variableId, variableData);
          } else if (subCommand === 'delete') {
            const [variableId] = restArgs;
            return await this.n8nService.deleteVariable(variableId);
          }
          break;

        // DATA TABLE COMMANDS
        case 'tables':
          if (subCommand === 'list') {
            const options = restArgs[0] ? JSON.parse(restArgs[0]) : {};
            return await this.n8nService.getDataTables(options);
          }
          break;

        case 'table':
          if (subCommand === 'get') {
            const [tableId] = restArgs;
            return await this.n8nService.getDataTable(tableId);
          } else if (subCommand === 'create') {
            const tableData = JSON.parse(restArgs[0]);
            return await this.n8nService.createDataTable(tableData);
          } else if (subCommand === 'update') {
            const [tableId, tableDataStr] = restArgs;
            const tableData = JSON.parse(tableDataStr);
            return await this.n8nService.updateDataTable(tableId, tableData);
          } else if (subCommand === 'delete') {
            const [tableId] = restArgs;
            return await this.n8nService.deleteDataTable(tableId);
          } else if (subCommand === 'rows') {
            const action = restArgs[0];
            const tableId = restArgs[1];

            if (action === 'get') {
              const optionsStr = restArgs[2];
              const options = optionsStr ? JSON.parse(optionsStr) : {};
              return await this.n8nService.getDataTableRows(tableId, options);
            } else if (action === 'create') {
              const rowDataStr = restArgs[2];
              const rowData = JSON.parse(rowDataStr);
              return await this.n8nService.createDataTableRows(tableId, rowData);
            } else if (action === 'update') {
              const updateDataStr = restArgs[2];
              const updateData = JSON.parse(updateDataStr);
              return await this.n8nService.updateDataTableRows(tableId, updateData);
            } else if (action === 'delete') {
              const deleteOptionsStr = restArgs[2];
              const deleteOptions = JSON.parse(deleteOptionsStr);
              return await this.n8nService.deleteDataTableRows(tableId, deleteOptions);
            }
          } else if (subCommand === 'row') {
            if (restArgs[0] === 'upsert') {
              const [tableId, upsertDataStr] = restArgs.slice(1);
              const upsertData = JSON.parse(upsertDataStr);
              return await this.n8nService.upsertDataTableRow(tableId, upsertData);
            }
          }
          break;

        // SOURCE CONTROL
        case 'source':
          if (subCommand === 'pull') {
            const options = restArgs[0] ? JSON.parse(restArgs[0]) : {};
            return await this.n8nService.pullFromSourceControl(options);
          }
          break;

        // SYSTEM
        case 'user':
          if (subCommand === 'get') {
            return await this.n8nService.getCurrentUser();
          }
          break;

        case 'health':
          if (subCommand === 'check') {
            return await this.n8nService.healthCheck();
          }
          break;

        default:
          throw new Error(`Unknown n8n command: ${command}`);
      }

      throw new Error(`Unknown n8n subcommand: ${subCommand}`);
    } catch (error) {
      console.error('[N8nTool] Error:', error);
      throw error;
    }
  }
}
