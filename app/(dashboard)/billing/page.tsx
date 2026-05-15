import { getProfile, createCheckoutSession, createPortalSession } from '@/lib/actions/billing'
import { PLANS, isTrialActive, trialDaysLeft } from '@/lib/stripe/plans'
import { redirect } from 'next/navigation'
import { CheckCircle2, Zap } from 'lucide-react'

async function CheckoutButton({ interval }: { interval: 'month' | 'year' }) {
  async function action() {
    'use server'
    const url = await createCheckoutSession(interval)
    redirect(url)
  }

  const label = interval === 'month'
    ? `Subscribe — $${PLANS.pro.monthlyPrice}/mo`
    : `Subscribe — $${PLANS.pro.yearlyPrice}/yr  (2 months free)`

  return (
    <form action={action}>
      <button
        type="submit"
        className={`w-full py-2.5 rounded-md text-sm font-medium transition-colors ${
          interval === 'month'
            ? 'border border-border hover:bg-muted'
            : 'bg-orange-500 hover:bg-orange-600 text-white'
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
      <button type="submit"
        className="border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
        Manage billing
      </button>
    </form>
  )
}

export default async function BillingPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const isPro       = profile.plan === 'pro'
  const isTrial     = profile.plan === 'trial' && isTrialActive(profile.trial_ends_at)
  const daysLeft    = trialDaysLeft(profile.trial_ends_at)
  const isExpired   = profile.plan === 'trial' && !isTrialActive(profile.trial_ends_at)

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your Filametry subscription.</p>
      </div>

      {/* Current plan banner */}
      <div className={`rounded-xl border p-5 flex items-center justify-between gap-4 ${
        isPro     ? 'border-orange-500/40 bg-orange-500/5' :
        isTrial   ? 'border-blue-500/40 bg-blue-500/5' :
                    'border-red-500/40 bg-red-500/5'
      }`}>
        <div>
          <p className="font-semibold">
            {isPro     ? 'Pro plan' :
             isTrial   ? `Free trial — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` :
                         'Trial expired'}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isPro   ? 'All features unlocked. Thank you!' :
             isTrial ? 'Upgrade before your trial ends to keep all your data.' :
                       'Your trial has ended. Upgrade to continue using Filametry.'}
          </p>
        </div>
        {isPro && <ManageButton />}
      </div>

      {/* Pricing cards — shown when not Pro */}
      {!isPro && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Monthly */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <p className="font-semibold">Monthly</p>
              <p className="text-3xl font-bold mt-1">${PLANS.pro.monthlyPrice}
                <span className="text-base font-normal text-muted-foreground">/mo</span>
              </p>
            </div>
            <CheckoutButton interval="month" />
          </div>

          {/* Yearly — highlighted */}
          <div className="rounded-xl border border-orange-500/40 bg-orange-500/5 p-6 space-y-5 relative overflow-hidden">
            <div className="absolute top-3 right-3 text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">
              BEST VALUE
            </div>
            <div>
              <p className="font-semibold">Yearly</p>
              <p className="text-3xl font-bold mt-1">${PLANS.pro.yearlyPrice}
                <span className="text-base font-normal text-muted-foreground">/yr</span>
              </p>
              <p className="text-xs text-orange-500 mt-0.5">~$15.83/mo · 2 months free</p>
            </div>
            <CheckoutButton interval="year" />
          </div>
        </div>
      )}

      {/* Features list */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="size-4 text-orange-500" />
          <p className="font-semibold">What's included in Pro</p>
        </div>
        <ul className="space-y-2.5">
          {PLANS.pro.features.map(f => (
            <li key={f} className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-green-400 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
