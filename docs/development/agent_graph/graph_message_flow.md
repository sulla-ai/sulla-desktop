# Agent Graph Message Flow (ASCII)

This diagram shows:
- **Graph-level messages** (`state.messages`)
- **Node-level messages** (`state.metadata.__messages_<nodeId>.messages`)

---

## 1) Graph routing (node execution order)

```text
[input_handler]
      |
      v
[plan_retrieval] --(low)-------------------------------> [output]
      | (medium)
      +-----------------------------------------------> [action]
      | (high/default)
      v
   [planner] --(PRD missing/retry)--> [planner]
      |
      v
  [reasoning] --(no TEB/retry)-----> [reasoning]
      |
      v
   [action] --(loop count < max and no final response)--> [action]
      |
      +--(has action response OR loop cap)--------------> [skill_critic]
                                                        |
                                                        +-- technical+project complete -> [output]
                                                        +-- technical incomplete ---------> [reasoning]
                                                        +-- technical done, project not --> [planner]

[output] --(cycleComplete=false)--> [input_handler]
```

---

## 2) Message storage lanes

```text
                         +-------------------------------------------+
                         |           GRAPH-LEVEL LANE                |
                         |               state.messages              |
                         +-------------------------------------------+

input_handler    plan_retrieval    planner      reasoning      action      skill_critic      output
     |                 |              |            |             |              |              |
     |                 |              |            |             |              |              |
     |                 |              |            +---- adds/refreshes -----> [TEB message]  |
     |                 |              |            |             |              |              |
     |                 |              |            |             +---- adds ---> [action evidence snapshot]
     |                 |              |            |             |              |              |
     |                 |              |            |             |              +--(negative only)--> [critic negative feedback]
     |                 |              |            |             |              |              |
     +-----------------------------------------------------------------------------------------+


                         +-------------------------------------------+
                         |           NODE-LEVEL LANE                 |
                         |      state.metadata.__messages_*          |
                         +-------------------------------------------+

planner namespace:   __messages_planner
  - lane is seeded from graph messages on first namespace initialization
  - receives graph assistant context (shared_context_*) + planner custom assistant context
  - planner excludes graph user messages; user directive is the PlanRetrieval goal
  - shared_context_* replay from planner history is filtered to avoid duplication
  - stores planner assistant/tool transcript for planner-local continuity

reasoning namespace: __messages_reasoning
  - lane is seeded from graph messages on first namespace initialization
  - receives PRD + selected skill environment + execution-readiness snapshot context
  - TEB prompt requires execution-ready context transfer (discovery/credentials/artifacts/blockers)
  - stores reasoning assistant transcript

action namespace:    __messages_action
  - stores full action assistant/tool transcript
  - reused by Action in next self-loop cycle
  - full transcript is passed into Critic prompt as "Action Conversation Transcript"

skill_critic namespace: (no dedicated node-local transcript required for routing)
```

---

## 3) Per-node message behavior summary

```text
Node            Reads from graph messages?   Writes graph messages?                   Writes node-level?
--------------  --------------------------   ---------------------------------------  -------------------
input_handler   yes                          normal graph flow                         default behavior
plan_retrieval  yes                          yes (shared_context_environment + shared_context_observational_memory)  default behavior
planner         yes (assistant only)         yes (shared_context_skill_environment) before planner invoke            yes (__messages_planner)
reasoning       yes (assistant only)         yes (final TEB assistant message)                                     yes (__messages_reasoning)
action          no (custom node messages)    yes (action evidence snapshot)            yes (__messages_action)
skill_critic    yes (plus action transcript) yes (negative critic feedback only)       optional/minimal
output          yes                          normal graph flow                         default behavior
```

---

## 4) Shared context conventions (current)

```text
Graph-level shared context message kinds:
- shared_context_environment              (PlanRetrieval refreshes)
- shared_context_observational_memory     (PlanRetrieval refreshes)
- shared_context_skill_environment        (Planner refreshes from selected skill)

Removed:
- shared_context_observational_sop (no longer emitted as a separate message)

Planner UI emission rule:
- Planner sends only non-final chatter via websocket.
- FINAL_PRD content is never emitted to websocket chat.
- If output contains <FINAL_PRD> without </FINAL_PRD> (token truncation),
  Planner auto-closes the wrapper before extraction and chatter stripping.
```

