import { describe, expect, it } from 'vitest';
import { buildMcRoleWebhookUrl } from './mcHookUrl.js';

describe('buildMcRoleWebhookUrl', () => {
  it('sets pathname to /hooks/mc/{role} for any base origin', () => {
    expect(buildMcRoleWebhookUrl('http://127.0.0.1:48123/hooks/mc/cos', 'eng')).toBe(
      'http://127.0.0.1:48123/hooks/mc/eng',
    );
    expect(buildMcRoleWebhookUrl('https://example.com/hooks/mc/eng', 'qa')).toBe(
      'https://example.com/hooks/mc/qa',
    );
  });

  it('works for origin-only URLs', () => {
    expect(buildMcRoleWebhookUrl('http://127.0.0.1:48123', 'cos')).toBe(
      'http://127.0.0.1:48123/hooks/mc/cos',
    );
    expect(buildMcRoleWebhookUrl('http://127.0.0.1:48123/', 'qa')).toBe(
      'http://127.0.0.1:48123/hooks/mc/qa',
    );
  });

  it('replaces non-mc paths with /hooks/mc/{role}', () => {
    expect(buildMcRoleWebhookUrl('https://gw.example/hooks/agent', 'eng')).toBe(
      'https://gw.example/hooks/mc/eng',
    );
  });
});
