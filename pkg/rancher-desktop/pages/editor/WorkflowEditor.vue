<template>
  <div
    ref="flowContainer"
    class="workflow-editor"
    :class="{ dark: isDark }"
    @dragover.prevent="onDragOver"
    @drop="onDrop"
  >
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :class="{ dark: isDark }"
      :default-viewport="{ zoom: 1 }"
      fit-view-on-init
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @connect="onConnect"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
    >
      <template #node-workflow="nodeProps">
        <WorkflowCustomNode v-bind="nodeProps" :is-dark="isDark" />
      </template>
      <Background :variant="BackgroundVariant.Dots" :gap="16" :size="1" />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background, BackgroundVariant } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@vue-flow/core';
import type { WorkflowDefinition, WorkflowNodeData } from './workflow/types';
import WorkflowCustomNode from './workflow/WorkflowCustomNode.vue';
import { getNodeDefinition } from './workflow/nodeRegistry';

const props = defineProps<{
  isDark: boolean;
  workflowData?: WorkflowDefinition | null;
}>();

const emit = defineEmits<{
  'node-selected': [node: { id: string; label: string; type?: string; data?: WorkflowNodeData } | null];
  'workflow-changed': [];
}>();

const flowContainer = ref<HTMLElement | null>(null);

const { applyNodeChanges, applyEdgeChanges, addEdges, addNodes, project, getViewport } = useVueFlow();

const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);

// Load workflow data when prop changes
watch(
  () => props.workflowData,
  (wf) => {
    if (wf) {
      nodes.value = wf.nodes.map(n => ({
        id:       n.id,
        type:     n.type,
        position: { ...n.position },
        data:     { ...n.data },
      }));
      edges.value = wf.edges.map(e => ({
        id:           e.id,
        source:       e.source,
        target:       e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label:        e.label,
        animated:     e.animated ?? true,
      }));
    } else {
      nodes.value = [];
      edges.value = [];
    }
  },
  { immediate: true },
);

function onNodesChange(changes: NodeChange[]) {
  applyNodeChanges(changes);
  emit('workflow-changed');
}

function onEdgesChange(changes: EdgeChange[]) {
  applyEdgeChanges(changes);
  emit('workflow-changed');
}

function onConnect(connection: Connection) {
  addEdges([{ ...connection, animated: true }]);
  emit('workflow-changed');
}

function onNodeClick({ node }: { node: Node }) {
  emit('node-selected', {
    id:    node.id,
    label: (node.data as WorkflowNodeData)?.label ?? (node.label as string),
    type:  node.type,
    data:  node.data as WorkflowNodeData,
  });
}

function onPaneClick() {
  emit('node-selected', null);
}

function updateNodeLabel(nodeId: string, label: string) {
  const node = nodes.value.find(n => n.id === nodeId);
  if (node && node.data) {
    (node.data as WorkflowNodeData).label = label;
  }
}

function updateNodeConfig(nodeId: string, config: Record<string, any>) {
  const node = nodes.value.find(n => n.id === nodeId);
  if (node && node.data) {
    (node.data as WorkflowNodeData).config = { ...config };
  }
  emit('workflow-changed');
}

// ── Drag and drop from palette ──

function onDragOver(event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function onDrop(event: DragEvent) {
  const raw = event.dataTransfer?.getData('application/vueflow');
  if (!raw) return;

  const { subtype, category } = JSON.parse(raw);
  const definition = getNodeDefinition(subtype);
  if (!definition) return;

  const bounds = flowContainer.value?.getBoundingClientRect();
  const position = project({
    x: event.clientX - (bounds?.left ?? 0),
    y: event.clientY - (bounds?.top ?? 0),
  });

  const newNode: Node = {
    id:   `node-${ Date.now() }`,
    type: 'workflow',
    position,
    data: {
      subtype,
      category,
      label:  definition.defaultLabel,
      config: definition.defaultConfig(),
    } as WorkflowNodeData,
  };

  addNodes([newNode]);
  emit('workflow-changed');
}

// ── Serialization ──

function serialize(): { nodes: any[]; edges: any[]; viewport: any } {
  const vp = getViewport();

  return {
    nodes: nodes.value.map(n => ({
      id:       n.id,
      type:     n.type,
      position: { x: n.position.x, y: n.position.y },
      data:     { ...(n.data as WorkflowNodeData) },
    })),
    edges: edges.value.map(e => ({
      id:           e.id,
      source:       e.source,
      target:       e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label:        e.label,
      animated:     e.animated,
    })),
    viewport: { x: vp.x, y: vp.y, zoom: vp.zoom },
  };
}

defineExpose({ updateNodeLabel, updateNodeConfig, serialize });
</script>

<style scoped>
.workflow-editor {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
}

.workflow-editor :deep(.vue-flow) {
  width: 100%;
  height: 100%;
}

/* Dark theme overrides */
.workflow-editor.dark :deep(.vue-flow) {
  background: #1a1a2e;
}

.workflow-editor.dark :deep(.vue-flow__edge-path) {
  stroke: #6366f1;
}

.workflow-editor.dark :deep(.vue-flow__minimap) {
  background: #1e293b;
}

.workflow-editor.dark :deep(.vue-flow__minimap-mask) {
  fill: rgba(99, 102, 241, 0.1);
}

.workflow-editor.dark :deep(.vue-flow__minimap-node) {
  fill: #4a4a6a;
}

.workflow-editor.dark :deep(.vue-flow__controls) {
  background: #2d2d44;
  border-color: #4a4a6a;
}

.workflow-editor.dark :deep(.vue-flow__controls-button) {
  background: #2d2d44;
  border-color: #4a4a6a;
  fill: #e2e8f0;
}

.workflow-editor.dark :deep(.vue-flow__controls-button:hover) {
  background: #3d3d5c;
}

.workflow-editor.dark :deep(.vue-flow__background pattern circle) {
  fill: #4a4a6a;
}
</style>
