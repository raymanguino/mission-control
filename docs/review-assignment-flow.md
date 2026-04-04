# Review Assignment Flow

The Mission Control backend already has complete support for automatic review assignment when tasks transition to review status.

## How It Works

### 1. Task Status Change to Review
When any task status is updated to `review` (typically when a developer completes implementation):

```typescript
// From backend/src/routes/handlers/tasks.ts
if (body.status === 'review' && existing.status !== 'review') {
  const implementer = existing.status === 'doing' && existing.assignedAgentId
    ? existing.assignedAgentId
    : null;
  const qa = await pickAgentByOrgRoleLeastLoaded('qa');
  updateData = {
    ...updateData,
    assignedAgentId: qa?.id ?? null,
    implementerAgentId: implementer,
  };
}
```

### 2. QA Agent Assignment
- Automatically finds a QA agent using `pickAgentByOrgRoleLeastLoaded('qa')`
- Preserves the original implementer in `implementerAgentId`
- Reassigns the task to the QA agent

### 3. Review Event Notification
```typescript
const enteringReview = body.status === 'review' && existing.status !== 'review';

if (enteringReview && task.assignedAgentId) {
  await notifyReviewAssignedAgent(id, task.assignedAgentId, request.log);
}
```

### 4. Webhook Delivery
```typescript
// From backend/src/services/agentNotifier.ts
export async function notifyAssignedAgentOfReviewAssigned(
  agent: { hookUrl: string | null; hookToken: string | null },
  task: { id: string; title: string; description: string | null },
  projectName: string,
): Promise<void> {
  await postToAgentWebhook(agent.hookUrl, agent.hookToken, {
    event: 'review.assigned',
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      projectName,
    },
  });
}
```

## Agent Requirements

For automatic review assignment to work, you need:

1. **Agent with QA role**: Agent must be registered with `orgRole: 'qa'`
2. **Hook configuration**: Agent must have both `hookUrl` and `hookToken` set
3. **Hook endpoint**: The agent's OpenClaw instance must handle `review.assigned` events

## Example Flow

1. Developer (Hermes) completes task → calls `update_task(status: 'review')`
2. MC backend automatically:
   - Finds least-loaded QA agent
   - Reassigns task to QA agent
   - Fires `review.assigned` webhook
3. QA agent (Qwen) receives notification and begins review

## Testing the Flow

```bash
# Create a test task assigned to a developer
curl -X POST "http://localhost:3001/api/tasks" \
  -H "Authorization: Bearer <api-key>" \
  -d '{"projectId": "...", "title": "Test Task", "assignedAgentId": "<dev-agent-id>"}'

# Developer marks it as review
curl -X PATCH "http://localhost:3001/api/tasks/<task-id>" \
  -H "Authorization: Bearer <api-key>" \
  -d '{"status": "review"}'

# Check that it's now assigned to a QA agent
curl -X GET "http://localhost:3001/api/tasks/<task-id>" \
  -H "Authorization: Bearer <api-key>"
```

## Current Status

✅ **Backend logic**: Complete and working
✅ **Webhook notifications**: Implemented 
✅ **QA agent assignment**: Automatic via least-loaded logic
✅ **Event payload**: Includes task details and project name

The review assignment flow is **fully functional** as of the current codebase.
