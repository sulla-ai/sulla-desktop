<template>
  <div class="w-full h-full">
    <div id="graph-container" class="w-full h-full"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import NeoVis, { NEOVIS_ADVANCED_CONFIG, NeovisConfig } from 'neovis.js';

let vis: any = null;

onMounted(() => {
  const config = {
    containerId: 'graph-container',
    nonFlat: false,
    neo4j: {
      serverUrl: 'bolt://127.0.0.1:7687',
      serverUser: 'neo4j',
      serverPassword: ''
    },
    labels: {
      Document: {
        label: 'title',
        [NEOVIS_ADVANCED_CONFIG]: {
          static: {
            color: '#00bcff',          // cyan glow
            size: 45,
            font: { size: 0 }
          },
          dynamic: {
            size: { property: 'importance', defaultValue: 35, min: 30, max: 70 }
          }
        }
      },
      Person: {
        label: 'name',
        [NEOVIS_ADVANCED_CONFIG]: {
          static: {
            color: '#c6d2ff',          // magenta pulse
            size: 40,
            font: { color: '#ffd1f0', size: 0 }
          }
        }
      },
      Entity: {
        label: 'name',
        [NEOVIS_ADVANCED_CONFIG]: {
          static: {
            color: '#00bcff',          // violet neon
            size: 35,
            font: { color: '#d1c4ff', size: 0 }
          }
        }
      }
    },
    relationships: {
      MENTIONS: {
        value: 'weight',
        [NEOVIS_ADVANCED_CONFIG]: {
          static: {
            color: '#00eaff',
            dashes: false,
            arrows: { to: { scaleFactor: 0.6 } }
          },
          dynamic: {
            width: { property: 'weight', min: 1, max: 5 }
          }
        }
      },
      RELATED_TO: {
        [NEOVIS_ADVANCED_CONFIG]: {
          static: {
            color: '#a78bfa',
            dashes: true,
            dashesArray: [5, 5]
          }
        }
      },
      KNOWS: {
        [NEOVIS_ADVANCED_CONFIG]: {
          static: {
            color: '#ff6bcb'
          }
        }
      }
    },
    initialCypher: `
      MATCH (d:Document)-[r*..2]-(n)
      RETURN * LIMIT 300
    `,
    visConfig: {
      physics: {
        enabled: true,
        forceAtlas2Based: {
          gravitationalConstant: -120,
          centralGravity: 0.005,
          springLength: 300,
          springConstant: 0.02,
          damping: 0.22
        },
        minVelocity: 0.001,
        solver: 'forceAtlas2Based',
        stabilization: false,
        timestep: 0.35,
        adaptiveTimestep: true
      },
      nodes: {
        shape: 'dot',
        size: 28,
        borderWidth: 3,
        color: { border: '#00d4ff', background: '#001f3f' },
        shadow: { enabled: true, color: 'rgba(0,212,255,0.6)', size: 25, x: 0, y: 0 }
      },
      edges: {
        color: '#00d4ff',
        width: 1.5,
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        smooth: { enabled: true, type: 'continuous', roundness: 0.4 },
        shadow: { enabled: true, color: 'rgba(0,212,255,0.3)' }
      },
      interaction: {
        hover: true,
        dragNodes: true,
        dragView: true,
        keyboard: true,
        zoomView: true,
        navigationButtons: false
      }
    }
  };

  vis = new NeoVis(config as NeovisConfig);
  vis.render();

  // Optional: pulse animation on nodes
  setTimeout(() => {
    if (vis?.network) {
      vis.network.on('afterDrawing', (_ctx: any) => {
        // Simple glow pulse effect (advanced: use shaders if needed)
      });
    }
  }, 1000);
});

onUnmounted(() => {
  if (vis) vis.clearNetwork();
});
</script>

<style scoped>
/* Load sci-fi font if you want */
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
</style>