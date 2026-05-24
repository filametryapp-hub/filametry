export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/filametry-symbol.svg"
            alt="Filametry"
            width={64}
            height={64}
            style={{ width: 64, height: 64, borderRadius: 14 }}
          />
          <p className="text-xs text-muted-foreground font-mono">Print smarter. Price better.</p>
        </div>
        {children}
      </div>
    </div>
  )
}
