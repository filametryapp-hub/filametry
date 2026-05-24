import { Suspense } from 'react'
import { PricingCalculator } from '@/components/pricing/calculator'

export default function PrecificacaoPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Precificação</h1>
        <p className="text-muted-foreground mt-1">
          Preencha os parâmetros de impressão e obtenha o preço de venda sugerido.
        </p>
      </div>
      <Suspense>
        <PricingCalculator />
      </Suspense>
    </div>
  )
}
