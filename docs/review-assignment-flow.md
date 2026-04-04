# Review assignment flow

Mission Control routes **engineers** to own tasks through `review` status. **QA** is notified via webhook when **every** task in a project is in `review` (batch-ready gate).

## Engineer on create and update

- New tasks are assigned to a **least-loaded** `engineer` (`pickAgentByOrgRoleLeastLoaded('engineer')`).
- `task.assigned` is delivered to that engineer’s webhook (when configured).

## Transition into `review`

When `PATCH` sets `status` to `review` and the task was not already in review:

- Unless the client sends an explicit `assignedAgentId`, the server assigns a **least-loaded engineer** and stores the previous `doing` assignee in `implementerAgentId` (when applicable).
- `task.assigned` is sent to the engineer (not `review.assigned`).

If the request body includes `assignedAgentId`, that assignee is kept and `implementerAgentId` is still set from the prior `doing` assignee when relevant.

## QA batch: all tasks in `review`

When, after a create or update, **every** task in the project has `status === 'review'`:

- Mission Control picks a **least-loaded** `qa` agent and sends `review.assigned` with `allTasksInReview: true`, plus `project` `{ id, name }` and the triggering `task` object (see [Agent Integration](./agent-integration.md)).

QA batch is emitted when:

- `POST /api/tasks` creates a task with `status: review` and the project is entirely in review, or
- `PATCH` moves a task into `review` (`enteringReview`) and the project becomes entirely in review.

It does **not** re-fire on unrelated edits while the project stays all-review.

## Leaving review

When moving back to `backlog` or `not_done`, `assignedAgentId` is restored from `implementerAgentId` when present (see `backend/src/routes/handlers/tasks.ts`).

## Agent requirements

1. **Engineer** agents for implementation and review ownership on the task row.
2. **QA** agents with `hookUrl` / `hookToken` for the batch `review.assigned` webhook.
3. Optional: email notifications mirror the webhook paths where email is configured.

## Example

1. Engineer completes work → `update_task(id, { status: 'review' })`.
2. MC assigns a least-loaded engineer, fires `task.assigned`.
3. When the last task in the project enters `review`, MC fires `review.assigned` with `allTasksInReview: true` to a least-loaded QA agent.
