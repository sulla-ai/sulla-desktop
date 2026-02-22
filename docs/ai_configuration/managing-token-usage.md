# Managing Token Usage

Sulla Desktop actively optimizes token usage in the system, but input quality still matters.

If you paste low-quality or oversized content, token usage can spike with little value.

## Most important rule

Only send the model the context it actually needs.

Large context windows are not always better. Massive inputs can increase cost, slow responses, and cause workflows to fail.

## Be careful what you paste

Avoid pasting raw content like:

- Full HTML pages
- Microsoft Word content with hidden formatting/characters
- Large copied blobs with repetitive or irrelevant text

These often add hidden tokens that provide no useful signal to the model.

## Better paste workflow

Before pasting content:

1. Clean and simplify text first.
2. Remove page chrome, scripts, and markup junk.
3. Keep only the specific section relevant to your task.
4. Prefer plain text when possible.

## Why oversized context causes problems

Dumping huge context can:

- Increase token spend quickly
- Reduce response quality (more noise, less signal)
- Slow down tool execution
- Hit model/context limits and break task completion

## Practical ways to reduce token usage

- Break large tasks into smaller steps
- Send summaries instead of full documents
- Ask follow-up questions with focused context
- Reuse concise system instructions
- Keep prompts specific and action-oriented

## Recommended team habits

- Treat tokens like a resource budget
- Paste only what is necessary for the current step
- Prefer "small context, multiple turns" over "massive one-shot prompt"

## Quick checklist

Before sending a prompt, check:

- [ ] Is this the minimum context needed?
- [ ] Did I remove hidden-formatting sources (Word/HTML junk)?
- [ ] Can I summarize this instead of pasting everything?
- [ ] Is my request specific enough to avoid unnecessary back-and-forth?
