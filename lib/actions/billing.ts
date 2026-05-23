'use server'

import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { getPlanById, TRIAL_PRINTER_LIMIT, isTrialActive, trialDaysLeft } from '@/lib/stripe/plans'

export async function createCheckoutSession(priceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id ? undefined : user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { user_id: user.id },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=1`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    subscription_data: {
      metadata: { user_id: user.id },
    },
  })

  return session.url!
}

export async function createPortalSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) throw new Error('No billing account found')

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  })

  return session.url
}

export async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
}

export async function getUserPlan() {
  const profile = await getProfile()
  if (!profile) return null

  const planDef = getPlanById(profile.plan) ?? null
  const onTrial = profile.plan === 'trial' && isTrialActive(profile.trial_ends_at)
  const daysLeft = trialDaysLeft(profile.trial_ends_at)

  // ── OPEN BETA ─────────────────────────────────────────────────
  // All features unlocked during testing. Remove this block before launch.
  const OPEN_BETA = true
  if (OPEN_BETA) {
    return {
      planId:       profile.plan as string,
      planDef,
      onTrial:      true,
      daysLeft:     365,
      printerLimit: 9999,
      isActive:     true,
    }
  }
  // ─────────────────────────────────────────────────────────────

  const printerLimit: number = profile.printer_limit ?? TRIAL_PRINTER_LIMIT

  return {
    planId: profile.plan as string,
    planDef,
    onTrial,
    daysLeft,
    printerLimit,
    isActive: profile.plan !== 'cancelled' && (profile.plan !== 'trial' || onTrial),
  }
}
