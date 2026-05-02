export function ErrorState({ error }: { error: string }) {
  return (
    <div className="panel border border-red/30 p-8 text-center">
      <h3 className="font-display text-2xl text-ink">The page could not be loaded</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">{error}</p>
    </div>
  );
}
