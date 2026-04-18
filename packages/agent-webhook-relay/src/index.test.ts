import { describe, expect, it } from 'vitest';
import { compareTokens, extractRoleFromPath, parseBearerToken, parseRoleList } from './index.js';

describe('parseRoleList', () => {
  it('keeps known roles only', () => {
    expect(Array.from(parseRoleList('cos,eng,qa,other'))).toEqual(['cos', 'eng', 'qa']);
  });
});

describe('extractRoleFromPath', () => {
  it('returns null for all paths — role is inferred from the event body, not the URL', () => {
    expect(extractRoleFromPath('/hooks/mc')).toBeNull();
    expect(extractRoleFromPath('/hooks/mc/')).toBeNull();
    expect(extractRoleFromPath('/hooks/mc/cos')).toBeNull();
    expect(extractRoleFromPath('/hooks/mc/eng')).toBeNull();
    expect(extractRoleFromPath('/hooks/mc/qa')).toBeNull();
    expect(extractRoleFromPath('/hooks/mc/other')).toBeNull();
  });
});

describe('parseBearerToken', () => {
  it('reads bearer auth headers', () => {
    expect(parseBearerToken('Bearer secret')).toBe('secret');
    expect(parseBearerToken('bearer secret')).toBe('secret');
    expect(parseBearerToken('Basic nope')).toBeUndefined();
  });
});

describe('compareTokens', () => {
  it('matches exact tokens', () => {
    expect(compareTokens('abc', 'abc')).toBe(true);
    expect(compareTokens('abc', 'abd')).toBe(false);
  });
});
