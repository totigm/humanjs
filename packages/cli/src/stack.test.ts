import { describe, expect, it } from 'vitest';
import { buildStackArgs, buildStackFilter } from './stack';

describe('buildStackFilter', () => {
  it('pads the shorter lane, never the longer one', () => {
    // The robotic lane finishes first, so it is the one that must hold.
    const filter = buildStackFilter(2000, 9000);
    expect(filter).toContain('[0:v]tpad=stop_mode=clone:stop_duration=7.000[l]');
    expect(filter).toContain('[1:v]null[r]');
  });

  it('pads the right lane when it is the shorter one', () => {
    const filter = buildStackFilter(9000, 2000);
    expect(filter).toContain('[1:v]tpad=stop_mode=clone:stop_duration=7.000[r]');
    expect(filter).toContain('[0:v]null[l]');
  });

  it('pads neither when the lanes match', () => {
    const filter = buildStackFilter(5000, 5000);
    expect(filter).not.toContain('tpad');
  });

  it('always ends in a two-input hstack', () => {
    expect(buildStackFilter(1000, 2000)).toContain('[l][r]hstack=inputs=2');
  });

  it('scales inside the graph, since -vf cannot coexist with -filter_complex', () => {
    expect(buildStackFilter(1000, 2000)).toContain('scale=trunc(iw/2)*2:trunc(ih/2)*2[v]');
  });

  it('expresses the pad in seconds, not milliseconds', () => {
    // ffmpeg reads stop_duration as seconds; passing ms silently freezes
    // the lane for a quarter of an hour.
    expect(buildStackFilter(0, 1500)).toContain('stop_duration=1.500');
  });
});

describe('buildStackArgs', () => {
  const args = buildStackArgs('a.mp4', 'b.mp4', 'out.mp4', 1000, 4000);

  it('overwrites without prompting, since the CLI already owns the path', () => {
    expect(args[0]).toBe('-y');
  });

  it('passes both lanes in order', () => {
    expect(args.slice(1, 5)).toEqual(['-i', 'a.mp4', '-i', 'b.mp4']);
  });

  it('encodes yuv420p so the result plays outside VLC', () => {
    expect(args).toContain('yuv420p');
  });

  it('never passes -vf, which ffmpeg rejects alongside -filter_complex', () => {
    expect(args).not.toContain('-vf');
  });

  it('writes to the requested output last', () => {
    expect(args[args.length - 1]).toBe('out.mp4');
  });
});
