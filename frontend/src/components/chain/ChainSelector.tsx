export function ChainSelector() {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm">
      <img src="/flow-icon.svg" alt="Flow" className="h-4 w-4" />
      <span className="hidden sm:inline">Flow Mainnet</span>
    </div>
  )
}
