import { stripe } from '@/lib/stripe'
import { getPlanByPriceId, TRIAL_PRINTER_LIMIT } from '@/lib/stripe/plans'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import type Stripe from 'stripe'

// Uses service role to bypass RLS for webhook updates
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function printerLimitForPriceId(priceId: string): number {
  const plan = getPlanByPriceId(priceId)
  if (!plan) return TRIAL_PRINTER_LIMIT
  return plan.printerLimit === Infinity ? 9999 : plan.printerLimit
}

export async function POST(req: Request) {
  const body        = await req.text()
  const headersList = await headers()
  const signature   = headersList.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const supabase = adminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.user_id
      if (!userId) break

      // Retrieve the subscription to get the price ID
      const subscriptionId = session.subscription as string
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = subscription.items.data[0]?.price.id ?? ''
      const plan = getPlanByPriceId(priceId)

      await supabase.from('profiles').update({
        plan: plan?.id ?? 'starter',
        printer_limit: printerLimitForPriceId(priceId),
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: subscriptionId,
      }).eq('id', userId)
      break
    }

    case 'customer.subscription.updated': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.user_id
      if (!userId) break

      if (sub.status === 'active') {
        const priceId = sub.items.data[0]?.price.id ?? ''
        const plan    = getPlanByPriceId(priceId)
        await supabase.from('profiles').update({
          plan: plan?.id ?? 'starter',
          printer_limit: printerLimitForPriceId(priceId),
        }).eq('id', userId)
      } else {
        await supabase.from('profiles').update({ plan: 'trial' }).eq('id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.user_id
      if (!userId) break

      await supabase.from('profiles').update({
        plan: 'cancelled',
        printer_limit: TRIAL_PRINTER_LIMIT,
        stripe_subscription_id: null,
      }).eq('id', userId)
      break
    }
  }

  return new Response('ok')
}
