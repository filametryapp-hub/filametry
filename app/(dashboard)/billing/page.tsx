import { getProfile, createCheckoutSession, createPortalSession } from '@/lib/actions/billing'
import { PLANS, isTrialActive, trialDaysLeft } from '@/lib/stripe/plans'
import { getPrinterCount } from '@/lib/actions/printers'
import { redirect } from 'next/navigation'
import { CheckCircle2, Printer } from 'lucide-react'

function yearlySavingsPct(plan: (typeof PLANS)[number]): number {
  const fullYear = plan.monthlyPrice * 12
  return Math.round(((fullYear - plan.yearlyPrice) / fullYear) * 100)
}

async function CheckoutButton({
  priceId,
  label,
  highlight,
}: {
  priceId: string
  label: string
  highlight?: boolean
}) {
  async function action() {
    'use server'
    const url = await createCheckoutSession(priceId)
    redirect(url)
  }

  return (
    <form action={action}>
      <button
        type="submit"
        className={`w-full py-2 rounded-md text-sm font-medium transition-colors ${
          highlight
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'border border-border hover:bg-muted'
        }`}
      >
        {label}
      </button>
    </form>
  )
}

async function ManageButton() {
  async function action() {
    'use server'
    const url = await createPortalSession()
    redirect(url)
  }
  return (
    <form action={action}>
      <button
        type="submit"
        className="border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors"
      >
        Manage billing
      </button>
    </form>
  )
}

export default async function BillingPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const isPaidPlan  = ['starter', 'growth', 'studio', 'enterprise'].includes(profile.plan)
  const isTrial     = profile.plan === 'trial' && isTrialActive(profile.trial_ends_at)
  const daysLeft    = trialDaysLeft(profile.trial_ends_at)
  const isExpired   = profile.plan === 'trial' && !isTrialActive(profile.trial_ends_at)
  const isCancelled = profile.plan === 'cancelled'
  const printerCount = await getPrinterCount()
  const printerLimit: number = profile.printer_limit ?? 2

  const statusLabel =
    isPaidPlan  ? `${profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)} plan` :
    isTrial     ? `Free trial — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` :
    isCancelled ? 'Subscription cancelled' :
                  'Trial expired'

  const statusDesc =
    isPaidPlan  ? 'All features unlocked. Thank you!' :
    isTrial     ? 'Upgrade before your trial ends to keep all your data.' :
    isCancelled ? 'Resubscribe to continue using Filametry.' :
                  'Your trial has ended. Upgrade to continue using Filametry.'

  const statusColor =
    isPaidPlan  ? 'border-blue-600/40 bg-blue-600/5' :
    isTrial     ? 'border-blue-500/40 bg-blue-500/5' :
                  'border-red-500/40 bg-red-500/5'

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your Filametry subscription.</p>
      </div>

      {/* Current plan banner */}
      <div className={`rounded-xl border p-5 flex items-center justify-between gap-4 ${statusColor}`}>
        <div>
          <p className="font-semibold">{statusLabel}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{statusDesc}</p>
          {(isPaidPlan || isTrial) && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <Printer className="size-3.5" />
              {printerCount} / {printerLimit === 9999 ? '∞' : printerLimit} printers used
            </p>
          )}
        </div>
        {isPaidPlan && <ManageButton />}
      </div>

      {/* Pricing cards */}
      <div>
        <h2 className="font-semibold mb-4">Choose a plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => {
            const isCurrent = profile.plan === plan.id
            const savings   = yearlySavingsPct(plan)

            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-5 space-y-4 relative flex flex-col ${
                  isCurrent
                    ? 'border-blue-600/60 bg-blue-600/5'
                    : 'border-border bg-card'
                }`}
              >
                {isCurrent && (
                  <span className="absolute top-3 right-3 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                    CURRENT
                  </span>
                )}

                <div>
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.printerRange}</p>
                  <p className="text-2xl font-bold mt-2">
                    ${plan.monthlyPrice.toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground"> / mo</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    or ${plan.yearlyPrice}/yr
                    <span className="text-blue-600 ml-1">save {savings}%</span>
                  </p>
                </div>

                <ul className="space-y-1.5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-green-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <ManageButton />
                ) : (
                  <div className="space-y-2">
                    <CheckoutButton
                      priceId={plan.monthlyPriceId}
                      label="Monthly"
                      highlight={false}
                    />
                    <CheckoutButton
                      priceId={plan.yearlyPriceId}
                      label={`Yearly — save ${savings}%`}
                      highlight={true}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
