export type PaperDemoDataMode = "live" | "static";
export type PaperDemoDataSource = "backend" | "static" | "none";

export function assertNoStaticOverrideInLiveMode({
  mode,
  component,
  dataSource,
}: {
  mode: PaperDemoDataMode;
  component: string;
  dataSource: PaperDemoDataSource;
  hasBackendSlice?: boolean;
}): { error: boolean; message: string | null } {
  if (mode === "live" && dataSource === "static") {
    const message = `ERROR: live mode is using static fallback data in ${component}. This must be fixed.`;
    console.error(`[OMNIA override error] ${component} is using static data in live mode`);
    return { error: true, message };
  }
  return { error: false, message: null };
}
