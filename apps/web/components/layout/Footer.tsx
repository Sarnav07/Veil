export function Footer() {
  return (
    <footer className="mt-auto border-t border-border-subtle">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
        <p className="text-xs text-text-secondary">
          &copy; {new Date().getFullYear()} Veil Protocol
        </p>

        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="text-xs text-text-secondary">Sui Testnet</span>
        </div>
      </div>
    </footer>
  );
}
