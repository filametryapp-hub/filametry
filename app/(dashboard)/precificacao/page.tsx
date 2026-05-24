import { Suspense } from 'react'
import { PricingCalculator } from '@/components/pricing/calculator'

export default function PrecificacaoPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Pricing Calculator</h1>
        <p className="text-muted-foreground mt-1">
          Fill in your print parameters and get the suggested sale price instantly.
        </p>
      </div>
      <Suspense>
        <PricingCalculator />
      </Suspense>
    </div>
  )
}
