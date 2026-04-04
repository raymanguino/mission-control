import { describe, expect, it } from 'vitest';
import { formatDiscordProjectFailure, formatDiscordProjectSuccess } from './projectAnnouncements.js';

describe('formatDiscordProjectSuccess', () => {
  it('includes project name, URL, and task resolutions', () => {
    const text = formatDiscordProjectSuccess(
      { id: 'p1', name: 'Alpha', url: 'https://example.com/p' },
      [
        { title: 'T1', resolution: 'https://solution/1' },
        { title: 'T2', resolution: null },
      ],
    );
    expect(text).toContain('**Project complete:** Alpha');
    expect(text).toContain('https://example.com/p');
    expect(text).toContain('T1');
    expect(text).toContain('https://solution/1');
  });
});

describe('formatDiscordProjectFailure', () => {
  it('includes project name and task lines', () => {
    const text = formatDiscordProjectFailure(
      { id: 'p1', name: 'Beta', url: null },
      [{ title: 'Task A', resolution: 'needs fix' }],
    );
    expect(text).toContain('**Project failed');
    expect(text).toContain('Beta');
    expect(text).toContain('Task A');
    expect(text).toContain('needs fix');
  });
});
