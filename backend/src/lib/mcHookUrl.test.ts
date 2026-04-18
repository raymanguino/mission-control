import { describe, expect, it } from 'vitest';
import { buildMcRoleWebhookUrl } from './mcHookUrl.js';

describe('buildMcRoleWebhookUrl', () => {
  it('always sets pathname to /hooks/mc regardless of role', () => {
    expect(buildMcRoleWebhookUrl('http://127.0.0.1:48123/hooks/mc/cos', 'eng')).toBe(
      'http://127.0.0.1:48123/hooks/mc',
    );
    expect(buildMcRoleWebhookUrl('https://example.com/hooks/mc/eng', 'qa')).toBe(
      'https://example.com/hooks/mc',
    );
  });

  it('works for origin-only URLs', () => {
    expect(buildMcRoleWebhookUrl('http://127.0.0.1:48123', 'cos')).toBe(
      'http://127.0.0.1:48123/hooks/mc',
    );
    expect(buildMcRoleWebhookUrl('http://127.0.0.1:48123/', 'qa')).toBe(
      'http://127.0.0.1:48123/hooks/mc',
    );
  });

  it('replaces any path with /hooks/mc', () => {
    expect(buildMcRoleWebhookUrl('https://gw.example/hooks/agent', 'eng')).toBe(
      'https://gw.example/hooks/mc',
    );
  });
});
