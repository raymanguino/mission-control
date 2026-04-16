import { describe, expect, it } from 'vitest';
import { compareTokens, extractRoleFromPath, parseBearerToken, parseRoleList } from './index.js';

describe('parseRoleList', () => {
  it('keeps known roles only', () => {
    expect(Array.from(parseRoleList('cos,eng,qa,other'))).toEqual(['cos', 'eng', 'qa']);
  });
});

describe('extractRoleFromPath', () => {
  it('parses role routes', () => {
    expect(extractRoleFromPath('/hooks/mc/cos')).toBe('cos');
    expect(extractRoleFromPath('/hooks/mc/eng')).toBe('eng');
    expect(extractRoleFromPath('/hooks/mc/qa')).toBe('qa');
  });

  it('rejects unknown or malformed paths', () => {
    expect(extractRoleFromPath('/hooks/mc')).toBeNull();
    expect(extractRoleFromPath('/hooks/mc/other')).toBeNull();
    expect(extractRoleFromPath('/hooks/mc/cos/extra')).toBeNull();
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
