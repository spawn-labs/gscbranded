interface HeaderProps {
  authenticated: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Header({ authenticated, onConnect, onDisconnect }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent-2)] font-display text-lg font-bold text-white shadow-lg shadow-indigo-500/30"
            aria-hidden
          >
            B
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              Branded Search Explorer
            </h1>
            <p className="text-xs text-[var(--color-muted)] sm:text-sm">
              GSC branded clicks × TikTok activity
            </p>
          </div>
        </div>
        {authenticated ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
          >
            Disconnect Google
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/25 transition hover:opacity-90"
          >
            Connect Google
          </button>
        )}
      </div>
    </header>
  );
}
