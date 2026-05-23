function FilametryMark() {
  const bars = [{ w: 28 }, { w: 9 }, { w: 9 }, { w: 21 }, { w: 9 }, { w: 9 }, { w: 9 }]
  return (
    <div className="flex flex-col gap-[2px]">
      {bars.map((b, i) => (
        <div key={i} className="h-[4px] bg-blue-600 rounded-full" style={{ width: b.w }} />
      ))}
    </div>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <FilametryMark />
          <span className="font-bold text-xl tracking-tight">Filametry</span>
          <p className="text-xs text-muted-foreground font-mono">Print smarter. Price better.</p>
        </div>
        {children}
      </div>
    </div>
  )
}
