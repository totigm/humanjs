import { describe, expect, it } from 'vitest';
import type { ActionResult, HumanAction, HumanPlugin, PluginContext } from './index';

describe('HumanPlugin', () => {
  it('accepts a minimal plugin with just a name', () => {
    const plugin: HumanPlugin = { name: 'minimal' };
    expect(plugin.name).toBe('minimal');
  });

  it('accepts a plugin with all four lifecycle hooks', () => {
    const calls: string[] = [];
    const plugin: HumanPlugin = {
      name: 'full',
      install: () => {
        calls.push('install');
      },
      beforeAction: () => {
        calls.push('before');
      },
      afterAction: () => {
        calls.push('after');
      },
      onError: () => {
        calls.push('error');
      },
    };
    plugin.install?.({} as PluginContext);
    plugin.beforeAction?.({ type: 'click' });
    plugin.afterAction?.({ type: 'click' }, { type: 'click', durationMs: 12 });
    plugin.onError?.({ type: 'click' }, new Error('boom'));
    expect(calls).toEqual(['install', 'before', 'after', 'error']);
  });

  it('supports async hooks', async () => {
    let seen = '';
    const plugin: HumanPlugin = {
      name: 'async',
      beforeAction: async (action) => {
        seen = action.type;
      },
    };
    await plugin.beforeAction?.({ type: 'type' });
    expect(seen).toBe('type');
  });
});

describe('HumanAction', () => {
  it('allows action types beyond a closed list', () => {
    const custom: HumanAction = { type: 'custom-action-not-in-core' };
    expect(custom.type).toBe('custom-action-not-in-core');
  });

  it('allows optional params with arbitrary keys', () => {
    const action: HumanAction = {
      type: 'click',
      params: { x: 100, y: 200, modifier: 'shift' },
    };
    expect(action.params?.x).toBe(100);
  });
});

describe('ActionResult', () => {
  it('echoes the originating type and includes a duration', () => {
    const result: ActionResult = { type: 'click', durationMs: 47 };
    expect(result.type).toBe('click');
    expect(result.durationMs).toBe(47);
  });
});
