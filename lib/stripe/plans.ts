export const PLANS = {
  trial: {
    name: 'Free Trial',
    days: 7,
    limits: {
      products: 5,
      filaments: 3,
      orders: 5,
    },
  },
  pro: {
    name: 'Pro',
    monthlyPrice: 19,
    yearlyPrice: 190,   // ~$15.8/mo — 2 months free
    limits: {
      products: Infinity,
      filaments: Infinity,
      orders: Infinity,
    },
    features: [
      'Unlimited products, filaments & orders',
      'Import from Bambu Studio / slicer',
      'PDF quote export',
      'Priority email support',
    ],
  },
} as const

export type Plan = keyof typeof PLANS

export function isTrialActive(trialEndsAt: string): boolean {
  return new Date(trialEndsAt) > new Date()
}

export function trialDaysLeft(trialEndsAt: string): number {
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
