import { evaluate } from '../../src/evaluator/evaluator.ts';

type Step =
  | { type: 'from'; action: () => Promise<unknown> | unknown }
  | { type: 'transform'; scriptPath: string }
  | { type: 'to'; action: (data: unknown) => Promise<void> | void };

/**
 * A fluent builder for creating Integration Pipelines.
 * This simulates a code-based orchestration (like Apache Camel or Mule Flows).
 */
export class Pipeline {
  private steps: Step[] = [];

  // Step 1: Extract
  from(action: () => Promise<unknown> | unknown): this {
    this.steps.push({ type: 'from', action });
    return this;
  }

  // Step 2: Transform
  transform(scriptPath: string): this {
    this.steps.push({ type: 'transform', scriptPath });
    return this;
  }

  // Step 3: Load
  to(action: (data: unknown) => Promise<void> | void): this {
    this.steps.push({ type: 'to', action });
    return this;
  }

  // Execute the collected steps sequentially
  async execute(): Promise<void> {
    let currentPayload: unknown = null;

    for (const step of this.steps) {
      if (step.type === 'from') {
        console.log("📥 [Pipeline] Executing 'From' connector...");
        currentPayload = await step.action();
      } else if (step.type === 'transform') {
        console.log(
          `⚙️  [Pipeline] Transforming via DataWeave (${step.scriptPath})...`,
        );

        // Resolve script path relative to this file
        const scriptUrl = new URL(step.scriptPath, import.meta.url);
        const script = Deno.readTextFileSync(scriptUrl);

        currentPayload = evaluate(script, {
          payload:
            currentPayload as import('../../src/evaluator/environment.ts').Value,
          attributes: {},
          vars: {},
        });
      } else if (step.type === 'to') {
        console.log("📤 [Pipeline] Executing 'To' connector...");
        await step.action(currentPayload);
      }
    }
  }
}
