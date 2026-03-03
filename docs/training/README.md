# Sulla Training System

The training system allows Sulla to learn from your conversations, documents, and skills
overnight via LoRA fine-tuning. It runs entirely on **bare metal** (the host machine) —
not inside the Lima VM — and produces new GGUF models that llama-server can hot-reload.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SULLA DESKTOP (Electron)                             │
│                                                                             │
│  ┌──────────────────────┐      ┌──────────────────────────────────────────┐ │
│  │   background.ts      │      │  LLMConversationFileLogger.ts           │ │
│  │   (Electron main)    │      │  (runs in every LLM provider)           │ │
│  │                      │      │                                          │ │
│  │  On startup:         │      │  On every chat response:                │ │
│  │  ensureTraining      │      │  ┌─────────────┐  ┌──────────────────┐  │ │
│  │  System(modelKey)    │      │  │ Log to       │  │ Write clean      │  │ │
│  │                      │      │  │ log/*.log    │  │ JSONL to         │  │ │
│  │  (non-blocking)      │      │  │ (debug)      │  │ feedback_queue/  │  │ │
│  │                      │      │  └─────────────┘  └───────┬──────────┘  │ │
│  └──────────┬───────────┘      └────────────────────────────┼────────────┘ │
│             │                                               │              │
└─────────────┼───────────────────────────────────────────────┼──────────────┘
              │                                               │
              ▼                                               ▼
┌─────────────────────────────┐    ┌──────────────────────────────────────────┐
│  LlamaCppService.ts         │    │  ~/Library/Application Support/          │
│  (bare metal, NOT Lima)     │    │  rancher-desktop/llm/                    │
│                             │    │                                          │
│  ensureTrainingSystem()     │    │  ├── models/          ← GGUF weights    │
│  ├── installTrainingDeps()  │    │  │   └── *.gguf                         │
│  ├── writeDocumentsConfig() │    │  ├── feedback_queue/  ← conversation    │
│  └── downloadTrainingModel()│    │  │   ├── conversations-2026-03-03.jsonl │
│                             │    │  │   └── processed/   ← archived        │
│  processDocuments()         │    │  └── training/                           │
│  runFullNightlyTraining()   │    │      ├── .venv/       ← Python venv     │
│                             │    │      ├── documents_config.json           │
└──────────────┬──────────────┘    │      ├── documents_knowledge.jsonl      │
               │                   │      ├── processed_manifest.json        │
               │ invokes           │      ├── replay_buffer.jsonl            │
               ▼                   │      ├── output/      ← checkpoints     │
┌──────────────────────────────┐   │      └── Qwen3.5-9B/  ← training model │
│  training/                   │   └──────────────────────────────────────────┘
│  (project root, real files)  │
│                              │
│  ├── train_nightly.py        │
│  └── documents_processor.py  │
└──────────────────────────────┘
```

---

## Three Training Data Sources

```
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│  1. CONVERSATIONS    │   │  2. DOCUMENTS         │   │  3. REPLAY BUFFER    │
│                      │   │                       │   │                      │
│  Every chat response │   │  Your personal files  │   │  Accumulated past    │
│  is automatically    │   │  scanned from folders  │   │  training data       │
│  captured in JSONL   │   │  you configure         │   │  (rolling 5000 max)  │
│  format              │   │                       │   │                      │
│  feedback_queue/     │   │  .txt .md .pdf .docx  │   │  replay_buffer.jsonl │
│  conversations-      │   │  → QA pairs in        │   │                      │
│  YYYY-MM-DD.jsonl    │   │  documents_knowledge  │   │                      │
│                      │   │  .jsonl               │   │                      │
└──────────┬───────────┘   └──────────┬────────────┘   └──────────┬───────────┘
           │                          │                           │
           └──────────────┬───────────┘                           │
                          │                                       │
                          ▼                                       │
               ┌─────────────────────┐                            │
               │  train_nightly.py   │◄───────────────────────────┘
               │                     │
               │  1. Load feedback   │
               │  2. Load doc knowledge
               │  3. Load replay buf │
               │  4. LoRA fine-tune  │
               │  5. Merge adapter   │
               │  6. Export GGUF     │
               │  7. Copy to models/ │
               │  8. Archive feedback│
               └─────────────────────┘
```

---

## Data Flow: Chat → Training

```
  User sends message
        │
        ▼
  OllamaService / AnthropicService / GoogleService / OpenAICompatibleService
        │
        │  sendRawRequest()
        │
        ├──► writeLLMConversationEvent({ direction: 'request', ... })
        │       │
        │       └──► handleTrainingCapture() → stashes messages array
        │
        ▼
  LLM responds (llama-server / cloud API)
        │
        ├──► writeLLMConversationEvent({ direction: 'response', ... })
        │       │
        │       └──► handleTrainingCapture()
        │               │
        │               ├── Skip if tool_calls only (not useful for training)
        │               ├── Skip if assistant content < 10 chars
        │               ├── Strip <thinking> tags
        │               │
        │               └── Write clean JSONL to feedback_queue/
        │                     {
        │                       "messages": [
        │                         {"role": "system", "content": "..."},
        │                         {"role": "user", "content": "..."},
        │                         {"role": "assistant", "content": "..."}
        │                       ]
        │                     }
        │
        ▼
  Response returned to user
```

---

## Data Flow: Documents → Training

```
  documents_processor.py --llm-root /path/to/llm
        │
        ▼
  Read documents_config.json
  (folders + file_types)
        │
        ▼
  Scan each folder recursively
        │
        ├── For each file matching file_types:
        │     │
        │     ├── Compute MD5 hash
        │     ├── Check processed_manifest.json
        │     │     │
        │     │     ├── Hash matches → SKIP (already processed)
        │     │     └── New or changed → PROCESS
        │     │
        │     ├── extract_text()
        │     │     ├── .pdf  → PyMuPDF (fitz)
        │     │     ├── .docx → python-docx
        │     │     └── .md/.txt → read_text()
        │     │
        │     ├── generate_qa_pairs()
        │     │     ├── Split on double-newlines (paragraphs)
        │     │     ├── Filter paragraphs > 50 chars
        │     │     ├── Cap at 15 per document
        │     │     └── Format as SFT messages
        │     │
        │     └── Append to documents_knowledge.jsonl
        │
        ▼
  Update processed_manifest.json
```

---

## Nightly Training Pipeline

```
  train_nightly.py --model unsloth/Qwen3.5-9B --llm-root /path/to/llm
        │
        ▼
  ┌─ 1. Load Feedback ──────────────────────────────────────────────┐
  │  Read feedback_queue/*.jsonl                                     │
  │  (conversations captured from chat)                              │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
  ┌─ 2. Combine with Replay ────┼───────────────────────────────────┐
  │  Append new to replay_buffer.jsonl                               │
  │  Load last 5000 entries                                          │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
  ┌─ 3. Load Document Knowledge ┼───────────────────────────────────┐
  │  Read documents_knowledge.jsonl                                  │
  │  (QA pairs from document processor)                              │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
  ┌─ 4. LoRA Training ──────────┼───────────────────────────────────┐
  │  Load base model (Unsloth 4-bit)                                 │
  │  Configure LoRA: r=16, alpha=16, dropout=0                       │
  │  Target modules: q/k/v/o_proj, gate/up/down_proj                 │
  │  Train: 2 epochs, batch=2, lr=2e-4, adamw_8bit                  │
  │  macOS: MLX backend (bf16)                                       │
  │  Linux/Windows: CUDA backend (fp16)                              │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
  ┌─ 5. Evaluate (optional) ────┼───────────────────────────────────┐
  │  If training/test_set/ exists, run eval metrics                  │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
  ┌─ 6. Merge + Export ─────────┼───────────────────────────────────┐
  │  Merge LoRA adapter into base model                              │
  │  Export as GGUF (q4_k_m quantization)                            │
  │  Copy .gguf to llm/models/                                       │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
  ┌─ 7. Archive Feedback ───────┼───────────────────────────────────┐
  │  Move feedback_queue/*.jsonl → feedback_queue/processed/         │
  └──────────────────────────────┴───────────────────────────────────┘
```

---

## Startup Flow

```
  Electron app starts
        │
        ▼
  background.ts — Electron.app.whenReady()
        │
        ├── ... settings, networking, UI, backend ...
        │
        ├── startBackend()  ← starts Lima VM + Docker
        │
        └── (async, non-blocking) ─────────────────────────────┐
              │                                                 │
              ▼                                                 │
        ensureTrainingSystem(modelKey)                          │
              │                                                 │
              ├── installTrainingDeps()                         │
              │     ├── Create .venv at llm/training/.venv/    │
              │     ├── pip install unsloth torch pymupdf ...   │
              │     └── Platform-aware (MLX vs CUDA)            │
              │                                                 │
              ├── writeDocumentsConfig()                        │
              │     └── Only if documents_config.json missing   │
              │                                                 │
              └── downloadTrainingModel(modelKey)               │
                    └── HuggingFace snapshot download            │
                                                                │
        Meanwhile, sulla.ts runs separately (inside Lima):      │
              ├── ensure() → install llama.cpp                  │
              ├── downloadModel() → GGUF weights                │
              └── startServer() → llama-server :30114           │
                                                                │
        Training system ready (no delay to inference) ──────────┘
```

---

## File Reference

### Project Files (source-controlled)

| File | Purpose |
|------|---------|
| `training/train_nightly.py` | LoRA fine-tuning + GGUF export pipeline |
| `training/documents_processor.py` | Incremental document scanner → QA pairs |
| `pkg/.../LlamaCppService.ts` | Training orchestration (venv, deps, invocation) |
| `pkg/.../LLMConversationFileLogger.ts` | Captures conversations → feedback_queue |
| `background.ts` | Hooks `ensureTrainingSystem()` on startup |

### Runtime Data (under `~/Library/Application Support/rancher-desktop/llm/`)

| Path | Purpose |
|------|---------|
| `training/.venv/` | Python virtual environment (unsloth + torch + doc libs) |
| `training/documents_config.json` | User-editable folder list for document scanning |
| `training/documents_knowledge.jsonl` | QA pairs extracted from documents |
| `training/processed_manifest.json` | MD5 hashes — tracks which docs are already processed |
| `training/replay_buffer.jsonl` | Rolling buffer of past training data (max 5000) |
| `training/output/` | Checkpoints + merged GGUF output |
| `training/<ModelName>/` | Downloaded Unsloth base model for training |
| `feedback_queue/` | Conversation JSONL files (one per day) |
| `feedback_queue/processed/` | Archived after training |
| `models/` | GGUF weights (inference + training output destination) |

---

## Configuration

### documents_config.json

Created automatically on first startup with defaults. Edit to point at your real folders:

```json
{
  "folders": [
    "/Users/you/Documents",
    "/Users/you/Projects",
    "/Users/you/Notes"
  ],
  "file_types": [".txt", ".md", ".pdf", ".docx"]
}
```

- **folders** — absolute paths to scan recursively
- **file_types** — file extensions to process

### Training Model Mapping

Each inference model maps to an Unsloth training repo:

| Model Key | Inference GGUF | Training Repo |
|-----------|---------------|---------------|
| `qwen3.5-9b` | `Qwen3.5-9B-Q4_K_M.gguf` | `unsloth/Qwen3.5-9B` |
| `qwen3.5-4b` | `Qwen3.5-4B-Q4_K_M.gguf` | `unsloth/Qwen3.5-4B` |
| `qwen3.5-0.8b` | `Qwen3.5-0.8B-Q4_K_M.gguf` | `unsloth/Qwen3.5-0.8B` |

---

## Platform Dependencies

### macOS

```
pip install "unsloth[mlx]" torch torchvision torchaudio pymupdf python-docx markdown \
  --index-url https://download.pytorch.org/whl/cpu
```

Uses the **MLX backend** with bf16 precision.

### Linux / Windows

```
pip install "unsloth[colab-new]" torch torchvision torchaudio pymupdf python-docx markdown \
  --index-url https://download.pytorch.org/whl/cu121
```

Uses the **CUDA backend** with fp16 precision.

---

## Running Training Manually

### Process Documents Only

```typescript
const service = getLlamaCppService();
await service.processDocuments();
```

Or directly:

```bash
/path/to/llm/training/.venv/bin/python \
  /path/to/sulla-desktop/training/documents_processor.py \
  --llm-root /path/to/llm
```

### Full Nightly Training

```typescript
const service = getLlamaCppService();
await service.runFullNightlyTraining('qwen3.5-9b');
```

Or directly:

```bash
/path/to/llm/training/.venv/bin/python \
  /path/to/sulla-desktop/training/train_nightly.py \
  --model unsloth/Qwen3.5-9B \
  --llm-root /path/to/llm
```

### train_nightly.py Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--model` | (required) | Unsloth HuggingFace repo ID |
| `--llm-root` | (required) | Absolute path to the `llm/` directory |
| `--output-dir` | `<llm-root>/training/output` | Where to save checkpoints + merged output |
| `--epochs` | `2` | Training epochs |
| `--batch-size` | `2` | Per-device batch size |
| `--lr` | `2e-4` | Learning rate |
| `--lora-r` | `16` | LoRA rank |
| `--quant-method` | `q4_k_m` | GGUF quantization method |

---

## How to Modify

### Add a new document folder

Edit `documents_config.json` at `~/Library/Application Support/rancher-desktop/llm/training/`:

```json
{
  "folders": [
    "/Users/you/Documents",
    "/Users/you/MyNewFolder"
  ]
}
```

Next time `processDocuments()` runs, it will pick up the new folder.

### Change training parameters

Edit `training/train_nightly.py` directly — it's a real file in the project, not generated.
Key things you might change:

- `--epochs` — more epochs = better fit but slower + risk of overfitting
- `--lora-r` — higher rank = more capacity but more VRAM
- `--quant-method` — try `q5_k_m` for higher quality, `q3_k_m` for smaller file

### Add a new training data source

1. Write JSONL files to `feedback_queue/` with this format:
   ```json
   {"messages":[{"role":"system","content":"..."},{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}
   ```
2. They'll be picked up on the next `runFullNightlyTraining()` call.

### Improve QA generation from documents

Edit `training/documents_processor.py` — specifically the `generate_qa_pairs()` function.
Currently it splits on paragraph boundaries (double-newlines) and creates one QA pair per
paragraph. You could improve this by:

- Using the LLM itself to generate better questions
- Extracting headings from Markdown to form more targeted questions
- Chunking by semantic similarity instead of paragraphs

### Add support for a new file type

In `training/documents_processor.py`, add a new branch to `extract_text()`:

```python
if suffix == ".html":
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(file_path.read_text(), "html.parser")
    return soup.get_text()
```

Then add `".html"` to `file_types` in your `documents_config.json` and add `beautifulsoup4`
to the pip install in `LlamaCppService.installTrainingDeps()`.

---

## Scheduling Nightly Training

The training system is designed to be triggered by a system scheduler.

### macOS (launchd)

Create `~/Library/LaunchAgents/com.sulla.nightly-training.plist` or hook into the
app's existing scheduler service. The entry point is:

```typescript
await getLlamaCppService().runFullNightlyTraining(modelKey);
```

### What happens at training time

1. `documents_processor.py` scans for new/changed files (incremental — uses MD5 hashes)
2. `train_nightly.py` combines all three data sources
3. LoRA fine-tuning runs (typically 10-30 minutes depending on data + hardware)
4. New GGUF is exported to `llm/models/`
5. Processed feedback is archived to `feedback_queue/processed/`
6. Restart llama-server to load the new model

---

## Troubleshooting

### Training venv not installing

Check that Python 3 is available on the host:

```bash
python3 --version
```

The system tries `python3` then `python` (on Linux/macOS) or `python`, `python3`, `py -3` (on Windows).

### Documents not being processed

1. Check `documents_config.json` exists and has valid folder paths
2. Folders must be absolute paths that exist on the host
3. Check `processed_manifest.json` — delete it to force reprocessing all files

### Training needs at least 5 samples

`train_nightly.py` exits early if there are fewer than 5 total training samples
(feedback + documents + replay buffer combined). Keep chatting or add more documents.

### GGUF not produced after training

Check `training/output/merged/` for the output. If empty, the LoRA merge or GGUF
export may have failed. Check console logs for Unsloth errors. Common causes:

- Not enough disk space
- Not enough RAM/VRAM for the model size
- Corrupted base model download (delete and re-download)
