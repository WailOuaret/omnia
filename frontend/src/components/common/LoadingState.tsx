export function LoadingState({ message = "Loading OMNIA demo state..." }: { message?: string }) {
  return (
    <div className="panel flex min-h-40 items-center justify-center p-8 text-center">
      <div>
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-border border-t-cyan" />
        <p className="text-sm text-muted">{message}</p>
      </div>
    </div>
  );
}
