/** Teacher-facing sample limitations (plain language). */
export const STATIC_SCENARIO_LIMITATIONS = [
  "This is a prepared walkthrough, not a live backend session.",
  "Your feedback choices are saved in this browser tab only.",
  "Structural filtering scores are not shown in this prepared scenario.",
] as const;

export function limitationsForDemo(isStaticScenario: boolean, raw: string[] = []): string[] {
  if (isStaticScenario) return [...STATIC_SCENARIO_LIMITATIONS];
  return raw;
}
