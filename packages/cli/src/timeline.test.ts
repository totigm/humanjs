import { describe, expect, it } from 'vitest';
import { UsageError } from './args';
import { parseTimeline, parseTimelineText } from './timeline';

const event = { type: 'click', params: { target: '#go' }, tMs: 0, durationMs: 120 };

describe('parseTimeline', () => {
  it('reads the object shape written by toTimeline()', () => {
    const timeline = parseTimeline(
      {
        version: 1,
        name: 'demo',
        personality: 'distracted',
        seed: 'abc',
        speed: 'fast',
        events: [event],
      },
      'f.json',
    );
    expect(timeline.events).toHaveLength(1);
    expect(timeline.personality).toBe('distracted');
    expect(timeline.seed).toBe('abc');
    expect(timeline.speed).toBe('fast');
  });

  it('accepts a bare array of events', () => {
    expect(parseTimeline([event], 'f.json').events).toHaveLength(1);
  });

  it('omits metadata that is absent rather than inventing it', () => {
    const timeline = parseTimeline({ events: [event] }, 'f.json');
    expect(timeline.personality).toBeUndefined();
    expect(timeline.speed).toBeUndefined();
    expect(timeline.seed).toBeUndefined();
  });

  it('ignores metadata of the wrong type instead of passing it through', () => {
    const timeline = parseTimeline({ events: [event], personality: 42, seed: null }, 'f.json');
    expect(timeline.personality).toBeUndefined();
    expect(timeline.seed).toBeUndefined();
  });

  describe('rejections explain the file, not the parser', () => {
    it('rejects a non-timeline object and says where timelines come from', () => {
      expect(() => parseTimeline({ hello: 1 }, 'notes.json')).toThrow(
        /notes.json is not a HumanJS timeline.*--record out.json/s,
      );
    });

    it('rejects an empty timeline', () => {
      expect(() => parseTimeline({ events: [] }, 'f.json')).toThrow(/no events.*nothing to replay/);
    });

    it('names the index of a malformed event', () => {
      expect(() => parseTimeline({ events: [event, { params: {} }] }, 'f.json')).toThrow(
        /malformed event at index 1.*string "type"/s,
      );
    });

    it('rejects an event missing the timing fields replay depends on', () => {
      // Caught here rather than mid-replay with a browser already open.
      expect(() => parseTimeline({ events: [{ type: 'click', params: {} }] }, 'f.json')).toThrow(
        /malformed event at index 0.*tMs.*durationMs/s,
      );
    });

    it('throws UsageError so the entry point prints it without a stack', () => {
      expect(() => parseTimeline(null, 'f.json')).toThrow(UsageError);
    });
  });
});

describe('parseTimelineText', () => {
  it('parses valid JSON', () => {
    expect(parseTimelineText(JSON.stringify({ events: [event] }), 'f.json').events).toHaveLength(1);
  });

  it('attributes a syntax error to the file', () => {
    expect(() => parseTimelineText('{ nope', 'broken.json')).toThrow(
      /broken.json is not valid JSON/,
    );
  });
});
