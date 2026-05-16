export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    printerLimit: 2,
    monthlyPrice: 19.90,
    yearlyPrice: 190,
    monthlyPriceId: 'price_1TXq3ZPtKi8WC2KUSShOjOCd',
    yearlyPriceId: 'price_1TXqG0PtKi8WC2KUH8tpSgSi',
    printerRange: '1–2 printers',
    features: [
      'Up to 2 registered printers',
      'Unlimited products, filaments & orders',
      'Import from Bambu Studio / slicer',
      'PDF quote export',
      'Email support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    printerLimit: 5,
    monthlyPrice: 49.90,
    yearlyPrice: 478,
    monthlyPriceId: 'price_1TXq6IPtKi8WC2KUhWqgkhAW',
    yearlyPriceId: 'price_1TXqH7PtKi8WC2KUwkO9W9g1',
    printerRange: '3–5 printers',
    features: [
      'Up to 5 registered printers',
      'Unlimited products, filaments & orders',
      'Import from Bambu Studio / slicer',
      'PDF quote export',
      'Priority email support',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    printerLimit: 15,
    monthlyPrice: 99.90,
    yearlyPrice: 958,
    monthlyPriceId: 'price_1TXq8iPtKi8WC2KUkkFmnh6k',
    yearlyPriceId: 'price_1TXqHjPtKi8WC2KUTSD6HSJ3',
    printerRange: '6–15 printers',
    features: [
      'Up to 15 registered printers',
      'Unlimited products, filaments & orders',
      'Import from Bambu Studio / slicer',
      'PDF quote export',
      'Priority email support',
      'Multi-printer cost allocation',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    printerLimit: Infinity,
    monthlyPrice: 129.90,
    yearlyPrice: 1246,
    monthlyPriceId: 'price_1TXqA0PtKi8WC2KUuJFIM4sO',
    yearlyPriceId: 'price_1TXqINPtKi8WC2KUda9ZM8fy',
    printerRange: '16+ printers',
    features: [
      'Unlimited registered printers',
      'Unlimited products, filaments & orders',
      'Import from Bambu Studio / slicer',
      'PDF quote export',
      'Dedicated support',
      'Multi-printer cost allocation',
      'Custom onboarding',
    ],
  },
] as const

export type PlanId = 'trial' | 'starter' | 'growth' | 'studio' | 'enterprise' | 'cancelled'

export type Plan = (typeof PLANS)[number]

/** Lookup a plan definition by its Stripe price ID. */
export function getPlanByPriceId(priceId: string): Plan | undefined {
  return PLANS.find(
    p => p.monthlyPriceId === priceId || p.yearlyPriceId === priceId
  )
}

/** Return the cheapest plan that covers the given printer count. */
export function getPlanForPrinterCount(count: number): Plan {
  return PLANS.find(p => p.printerLimit >= count) ?? PLANS[PLANS.length - 1]
}

/** Return the plan definition that matches a profile's plan id. */
export function getPlanById(planId: string): Plan | undefined {
  return PLANS.find(p => p.id === planId)
}

/** Printer limit for trial users — same as Starter. */
export const TRIAL_PRINTER_LIMIT = 2

export function isTrialActive(trialEndsAt: string): boolean {
  return new Date(trialEndsAt) > new Date()
}

export function trialDaysLeft(trialEndsAt: string): number {
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
