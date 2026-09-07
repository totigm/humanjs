import { describe, expect, it } from 'vitest';
import { DEFAULT_OUTPUT, laneLabelCss } from './compare';

describe('laneLabelCss', () => {
  it('renders the label through CSS content, needing no font on the host', () => {
    // ffmpeg's drawtext would need a font file present; the browser has fonts.
    const css = laneLabelCss('HumanJS · careful', '#f5a55c');
    expect(css).toContain('content: "HumanJS · careful"');
    expect(css).toContain('#f5a55c');
  });

  it('escapes quotes in the label rather than breaking the rule', () => {
    const css = laneLabelCss('the "fast" lane', '#fff');
    expect(css).toContain(String.raw`content: "the \"fast\" lane"`);
  });

  it('pins the banner above page content and keeps it click-through', () => {
    const css = laneLabelCss('x', '#fff');
    expect(css).toContain('position: fixed');
    expect(css).toContain('z-index: 2147483647');
    // The cursor must not be able to interact with the label itself.
    expect(css).toContain('pointer-events: none');
  });
});

describe('DEFAULT_OUTPUT', () => {
  it('is a video, since compare has no other useful shape', () => {
    expect(DEFAULT_OUTPUT).toMatch(/\.mp4$/);
  });
});
