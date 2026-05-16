import { getUserPrinters, getPrinterCount, addPrinter, deletePrinter } from '@/lib/actions/printers'
import { getProfile } from '@/lib/actions/billing'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Printer, Trash2, PlusCircle, Zap } from 'lucide-react'
import { TRIAL_PRINTER_LIMIT } from '@/lib/stripe/plans'

async function AddPrinterForm({ atLimit }: { atLimit: boolean }) {
  async function action(formData: FormData) {
    'use server'
    await addPrinter({
      name:   formData.get('name')   as string,
      brand:  formData.get('brand')  as string,
      model:  formData.get('model')  as string,
      watts:  Number(formData.get('watts') ?? 120),
    })
    revalidatePath('/printers')
  }

  if (atLimit) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
        <Printer className="size-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium">Printer limit reached</p>
        <p className="text-xs text-muted-foreground">
          Upgrade your plan to register more printers.
        </p>
        <a
          href="/billing"
          className="inline-flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors mt-1"
        >
          <Zap className="size-3" />
          Upgrade plan
        </a>
      </div>
    )
  }

  return (
    <form action={action} className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h2 className="font-semibold">Add printer</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="name">
            Nickname
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="e.g. Bambu A1 #1"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="brand">
            Brand
          </label>
          <input
            id="brand"
            name="brand"
            required
            placeholder="e.g. Bambu Lab"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="model">
            Model
          </label>
          <input
            id="model"
            name="model"
            required
            placeholder="e.g. A1"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="watts">
            Power consumption (W)
          </label>
          <input
            id="watts"
            name="watts"
            type="number"
            min="1"
            defaultValue={120}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>
      <button
        type="submit"
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
      >
        <PlusCircle className="size-4" />
        Add printer
      </button>
    </form>
  )
}

async function DeleteButton({ id }: { id: string }) {
  async function action() {
    'use server'
    await deletePrinter(id)
    revalidatePath('/printers')
  }

  return (
    <form action={action}>
      <button
        type="submit"
        className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
        title="Delete printer"
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  )
}

export default async function PrintersPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const printers    = await getUserPrinters()
  const count       = printers.length
  const limit: number = profile.printer_limit ?? TRIAL_PRINTER_LIMIT
  const atLimit     = count >= limit
  const displayLimit = limit === 9999 ? '∞' : String(limit)

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Printers</h1>
          <p className="text-muted-foreground mt-1">
            Manage your registered printers.
          </p>
        </div>
        <span className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-full font-medium shrink-0">
          {count} / {displayLimit} printers
        </span>
      </div>

      {/* Printer list */}
      {printers.length > 0 && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {printers.map(p => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Printer className="size-4 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.brand} {p.model} &middot; {p.watts}W
                </p>
              </div>
              <DeleteButton id={p.id} />
            </div>
          ))}
        </div>
      )}

      {printers.length === 0 && !atLimit && (
        <p className="text-sm text-muted-foreground">
          No printers registered yet. Add your first one below.
        </p>
      )}

      {/* Add form or upgrade prompt */}
      <AddPrinterForm atLimit={atLimit} />
    </div>
  )
}
