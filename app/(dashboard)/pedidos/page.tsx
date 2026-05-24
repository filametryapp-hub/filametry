import { OrderList } from '@/components/pedidos/order-list'

export default function PedidosPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe seus pedidos do rascunho à entrega.
        </p>
      </div>
      <OrderList />
    </div>
  )
}
