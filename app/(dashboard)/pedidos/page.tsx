import { OrderList } from '@/components/pedidos/order-list'

export default function PedidosPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground mt-1">
          Track quotes and orders from draft to delivery.
        </p>
      </div>
      <OrderList />
    </div>
  )
}
