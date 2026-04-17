import { describe, expect, it } from 'vitest';
import { applyMcRoleToHookUrl } from './mcHookUrl.js';

describe('applyMcRoleToHookUrl', () => {
  it('replaces an existing /hooks/mc/{role} segment', () => {
    expect(applyMcRoleToHookUrl('http://127.0.0.1:48123/hooks/mc/cos', 'eng')).toBe(
      'http://127.0.0.1:48123/hooks/mc/eng',
    );
    expect(applyMcRoleToHookUrl('https://example.com/hooks/mc/eng', 'qa')).toBe(
      'https://example.com/hooks/mc/qa',
    );
  });

  it('appends /hooks/mc/{role} for origin-only URLs', () => {
    expect(applyMcRoleToHookUrl('http://127.0.0.1:48123', 'cos')).toBe(
      'http://127.0.0.1:48123/hooks/mc/cos',
    );
    expect(applyMcRoleToHookUrl('http://127.0.0.1:48123/', 'qa')).toBe(
      'http://127.0.0.1:48123/hooks/mc/qa',
    );
  });

  it('normalizes legacy gateway paths to /hooks/mc/{role}', () => {
    expect(applyMcRoleToHookUrl('https://gw.example/hooks/agent', 'eng')).toBe(
      'https://gw.example/hooks/mc/eng',
    );
  });
});
