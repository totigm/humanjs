import type { TimelineEvent } from '@humanjs/playwright';
import type { AssertKind, Step, StepPatch } from './protocol';

/**
 * The canonical, editable timeline held by the CLI. Capture appends events;
 * the dashboard issues edit commands (delete / move / update / addAssert) that
 * mutate this list. Every step carries a stable id so edits can target it.
 *
 * Steps are valid `TimelineEvent`s (plus the id, which the codegen ignores), so
 * the list can be passed straight to `generateCode`.
 */
export class TimelineStore {
  #steps: Step[] = [];
  #counter = 0;

  /** The current steps, in order. */
  list(): readonly Step[] {
    return this.#steps;
  }

  /** Append a freshly captured event, assigning it an id. */
  append(event: TimelineEvent): void {
    this.#steps.push({ ...event, id: this.#nextId() });
  }

  delete(id: string): void {
    this.#steps = this.#steps.filter((step) => step.id !== id);
  }

  /** Move a step to a new index (clamped to the list bounds). */
  move(id: string, toIndex: number): void {
    const from = this.#steps.findIndex((step) => step.id === id);
    if (from === -1) return;
    const [step] = this.#steps.splice(from, 1);
    if (!step) return;
    const clamped = Math.max(0, Math.min(toIndex, this.#steps.length));
    this.#steps.splice(clamped, 0, step);
  }

  /** Reorder the timeline to match the given id order (a full-order set from a drag). */
  reorder(ids: readonly string[]): void {
    const byId = new Map(this.#steps.map((step) => [step.id, step]));
    const next: Step[] = [];
    for (const id of ids) {
      const step = byId.get(id);
      if (step) {
        next.push(step);
        byId.delete(id);
      }
    }
    // Keep any steps the client didn't mention (e.g. captured mid-drag) at the end.
    for (const step of this.#steps) if (byId.has(step.id)) next.push(step);
    this.#steps = next;
  }

  update(id: string, patch: StepPatch): void {
    this.#steps = this.#steps.map((step) => (step.id === id ? applyPatch(step, patch) : step));
  }

  /** Insert an assertion step after `afterId` (or at the end when null). */
  addAssert(afterId: string | null, kind: AssertKind, target?: string, value?: string): void {
    const params: Record<string, unknown> = { kind };
    if (target !== undefined) params.target = target;
    if (value !== undefined) params.value = value;
    const step: Step = { id: this.#nextId(), type: 'assert', params, tMs: 0, durationMs: 0 };

    const index = afterId === null ? this.#steps.length - 1 : this.#findIndex(afterId);
    this.#steps.splice(index + 1, 0, step);
  }

  #findIndex(id: string): number {
    return this.#steps.findIndex((step) => step.id === id);
  }

  #nextId(): string {
    this.#counter += 1;
    return `s${this.#counter}`;
  }
}

function applyPatch(step: Step, patch: StepPatch): Step {
  const params: Record<string, unknown> = { ...step.params };
  if (patch.target !== undefined) params.target = patch.target;
  if (patch.label !== undefined) params.label = patch.label;
  if (patch.secret !== undefined) {
    if (patch.secret === null) delete params.secret;
    else params.secret = patch.secret;
  }
  return {
    ...step,
    params,
    ...(patch.inputValue !== undefined ? { inputValue: patch.inputValue } : {}),
  };
}
