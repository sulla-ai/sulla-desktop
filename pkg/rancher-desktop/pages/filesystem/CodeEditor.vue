<template>
  <div ref="containerRef" class="code-editor-container"></div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as monaco from 'monaco-editor';

// Configure Monaco to work in Electron without web workers
(self as any).MonacoEnvironment = {
  getWorker() {
    return null as any;
  },
};

const EXT_LANGUAGE_MAP: Record<string, string> = {
  '.ts':         'typescript',
  '.tsx':        'typescript',
  '.js':         'javascript',
  '.jsx':        'javascript',
  '.mjs':        'javascript',
  '.cjs':        'javascript',
  '.json':       'json',
  '.jsonc':      'json',
  '.html':       'html',
  '.htm':        'html',
  '.css':        'css',
  '.scss':       'scss',
  '.less':       'less',
  '.xml':        'xml',
  '.svg':        'xml',
  '.yaml':       'yaml',
  '.yml':        'yaml',
  '.toml':       'ini',
  '.py':         'python',
  '.sh':         'shell',
  '.bash':       'shell',
  '.zsh':        'shell',
  '.sql':        'sql',
  '.graphql':    'graphql',
  '.gql':        'graphql',
  '.dockerfile': 'dockerfile',
  '.go':         'go',
  '.rs':         'rust',
  '.rb':         'ruby',
  '.php':        'php',
  '.java':       'java',
  '.c':          'c',
  '.cpp':        'cpp',
  '.h':          'cpp',
  '.cs':         'csharp',
  '.swift':      'swift',
  '.kt':         'kotlin',
  '.lua':        'lua',
  '.r':          'r',
  '.ini':        'ini',
  '.conf':       'ini',
  '.cfg':        'ini',
  '.env':        'ini',
  '.txt':        'plaintext',
  '.log':        'plaintext',
  '.gitignore':  'plaintext',
};

const FILENAME_LANGUAGE_MAP: Record<string, string> = {
  'dockerfile':  'dockerfile',
  'makefile':    'shell',
  'justfile':    'shell',
  'rakefile':    'ruby',
  'gemfile':     'ruby',
  '.editorconfig': 'ini',
};

function getLanguageFromFile(ext: string, filePath?: string): string {
  if (filePath) {
    const basename = filePath.split('/').pop()?.toLowerCase() || '';
    if (FILENAME_LANGUAGE_MAP[basename]) return FILENAME_LANGUAGE_MAP[basename];
  }
  return EXT_LANGUAGE_MAP[ext.toLowerCase()] || 'plaintext';
}

export default defineComponent({
  name: 'CodeEditor',

  props: {
    content:  { type: String, default: '' },
    filePath: { type: String, default: '' },
    fileExt:  { type: String, default: '' },
    isDark:   { type: Boolean, default: false },
  },

  emits: ['dirty'],

  setup(props, { emit }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let editor: monaco.editor.IStandaloneCodeEditor | null = null;

    function createEditor() {
      if (!containerRef.value) return;

      const language = getLanguageFromFile(props.fileExt, props.filePath);

      editor = monaco.editor.create(containerRef.value, {
        value:       props.content,
        language,
        theme:       props.isDark ? 'vs-dark' : 'vs',
        readOnly:    false,
        automaticLayout: true,
        minimap:     { enabled: true },
        scrollBeyondLastLine: false,
        fontSize:    13,
        lineNumbers: 'on',
        renderLineHighlight: 'line',
        wordWrap:    'on',
        padding:     { top: 8 },
      });

      // Listen for content changes to mark as dirty
      editor.onDidChangeModelContent(() => {
        // Emit dirty event to parent component
        emit('dirty');
      });
    }

    function updateContent() {
      if (editor) {
        const language = getLanguageFromFile(props.fileExt, props.filePath);
        const model = editor.getModel();
        if (model) {
          monaco.editor.setModelLanguage(model, language);
          model.setValue(props.content);
        }
      }
    }

    function updateTheme() {
      if (editor) {
        monaco.editor.setTheme(props.isDark ? 'vs-dark' : 'vs');
      }
    }

    onMounted(createEditor);

    watch(() => props.content, updateContent);
    watch(() => props.fileExt, updateContent);
    watch(() => props.isDark, updateTheme);

    onBeforeUnmount(() => {
      if (editor) {
        editor.dispose();
        editor = null;
      }
    });

    // Expose method to get current editor content
    const getContent = () => {
      return editor?.getValue() || props.content;
    };

    return {
      containerRef,
      getContent,
    };
  },
});
</script>

<style scoped>
.code-editor-container {
  width: 100%;
  height: 100%;
}
</style>
