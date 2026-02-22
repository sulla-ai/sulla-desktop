# Local Model Setup (Docker-based)

> WARNING
> Local models are currently best for testing and experimentation.
> Do not expect high performance from local models right now, especially on macOS where GPU acceleration support is limited for this workflow.
> If you want the best speed and quality, use a remote model provider.

Sulla Desktop supports local models through the Docker-based local model workflow.

## When to use local models

Use local models when you want to:

- Test local-only workflows
- Experiment with model behavior
- Prototype without relying on a remote API

For production-quality agent performance, remote models are still recommended.

## How to open local model settings

Use the app menu path below:

1. Open the main Electron menu.
2. Open **Language Model Settings**.
3. Go to **Models**.
4. Open **Local Models**.
5. Choose and configure the local model you want to run.

## How to choose a local model

For better local speed, choose models with:

- Lower parameter counts
- Lower context windows

These settings generally reduce resource usage and improve responsiveness on local hardware.

## Recommended model family to test

Qwen-family models are often among the better-performing local options.

That said, this is still "best of local" performance, which may not match remote model quality or speed.

## Performance expectations

- Local model speed depends heavily on your machine resources.
- Larger models can be noticeably slower.
- Mac performance may be limited for this local setup.

If agent quality or response speed is not acceptable, switch to a remote model in Language Model Settings.
