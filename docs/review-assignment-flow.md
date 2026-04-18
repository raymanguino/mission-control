# Review assignment flow

Mission Control does **not** auto-assign tasks to engineers or QA. Agents claim work by updating tasks (for example `PATCH` with `assignedAgentId` set to themselves).

## `project.backlog_updated` (engineers)

On every task create and update, Mission Control emits a single **`project.backlog_updated`** webhook to `/hooks/mc/eng` (see server env `MC_WEBHOOK_BASE_URL` and `MC_WEBHOOK_TOKEN`). The payload includes `projectId` and `project: { id, name }` but **not** `taskId`—OpenClaw lists open tasks via MCP/API and self-assigns.

## Transition into `review`

When `PATCH` sets `status` to `review` and the task was not already in review, the server sets **`implementerAgentId`** from the prior `doing` assignee when applicable. It does **not** set **`assignedAgentId`** automatically.

## QA batch: all tasks in `review`

When, after a create or update, **every** task in the project has `status === 'review'`:

- Mission Control sends **`project.all_tasks_completed`** once to `/hooks/mc/qa` (same env as above).
- Email notifications go to each QA agent that has email configured.

QA batch is emitted when:

- `POST` creates a task with `status: review` and the project is entirely in review, or
- `PATCH` moves a task into `review` and the project becomes entirely in review.

It does **not** re-fire on unrelated edits while the project stays all-review.

## Leaving review

When a task moves from `review` to `done`, Mission Control sends **`project.review_completed`** to `/hooks/mc/cos` with `taskId` plus project snapshot. Assignee fields may be cleared by the handler; Mission Control does not restore **`assignedAgentId`** from **`implementerAgentId`** automatically on other transitions.

## Server requirements

Configure **`MC_WEBHOOK_BASE_URL`** and **`MC_WEBHOOK_TOKEN`** on the Mission Control host so the relay at `/hooks/mc/{role}` accepts the same bearer for each role. Optional: email notifications mirror workflow where email is configured.
