import { ProductList } from '@/components/produtos/product-list'

export default function ProdutosPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="text-muted-foreground mt-1">
          Your catalog of printable parts — with cost, margin, and pricing at a glance.
        </p>
      </div>
      <ProductList />
    </div>
  )
}
