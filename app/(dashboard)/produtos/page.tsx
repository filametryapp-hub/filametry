import { ProductList } from '@/components/produtos/product-list'

export default function ProdutosPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <p className="text-muted-foreground mt-1">
          Seu catálogo de peças — com custo, margem e preço em um só lugar.
        </p>
      </div>
      <ProductList />
    </div>
  )
}
