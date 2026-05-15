import { FilamentList } from '@/components/filaments/filament-list'

export default function FilamentosPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Filaments</h1>
        <p className="text-muted-foreground mt-1">
          Track your spool inventory, cost per material, and consumption.
        </p>
      </div>
      <FilamentList />
    </div>
  )
}
