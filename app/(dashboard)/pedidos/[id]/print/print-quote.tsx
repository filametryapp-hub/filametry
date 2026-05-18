'use client'

import { useEffect } from 'react'

interface QuoteTier {
  qty: number
  unitPrice: number
}

interface OrderItem {
  productName: string
  quantity: number
  unitPrice: number
}

interface PrintOrder {
  id: string
  clientName: string
  clientEmail?: string
  notes?: string
  status: string
  createdAt: string
  showDiscountOnPrint: boolean
  quoteTiers: QuoteTier[] | null
  items: OrderItem[]
  productName: string
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PrintQuote({ order }: { order: PrintOrder }) {
  useEffect(() => {
    // Auto-trigger print dialog after a short delay for rendering
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [])

  const hasQuote = order.quoteTiers && order.quoteTiers.length > 0
  const maxPrice = hasQuote
    ? Math.max(...order.quoteTiers!.map(t => t.unitPrice))
    : 0

  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <>
      {/* Global print styles */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #111; }

        @media screen {
          body { background: #f5f5f5; display: flex; justify-content: center; padding: 40px 16px; }
          .page { background: #fff; width: 210mm; min-height: 297mm; box-shadow: 0 4px 24px rgba(0,0,0,.12); padding: 48px; }
          .no-print { display: flex; }
        }

        @media print {
          body { background: #fff; }
          .page { width: 100%; padding: 24px; box-shadow: none; }
          .no-print { display: none !important; }
          @page { margin: 16mm; }
        }

        .page { border-radius: 8px; }
      `}</style>

      {/* Screen-only toolbar */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: '#0f1117', borderBottom: '1px solid #222',
        padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => window.print()}
          style={{
            background: '#f97316', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          🖨️ Imprimir / Salvar PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{
            background: 'transparent', color: '#888', border: '1px solid #333',
            borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer',
          }}
        >
          Fechar
        </button>
        <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
          No diálogo de impressão, selecione "Salvar como PDF" para gerar o arquivo
        </span>
      </div>

      <div className="page" style={{ marginTop: 56 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
              Orçamento
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111', lineHeight: 1.1 }}>
              {order.clientName}
            </div>
            {order.clientEmail && (
              <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{order.clientEmail}</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>Data</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{today}</div>
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>Ref. #{order.id.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #f97316, #fed7aa)', borderRadius: 2, marginBottom: 32 }} />

        {/* Product */}
        {order.productName && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Produto</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{order.productName}</div>
          </div>
        )}

        {/* Quote table */}
        {hasQuote ? (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Tabela de Preços por Quantidade
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#fff7ed', borderBottom: '2px solid #f97316' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#f97316' }}>
                    Quantidade
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#f97316' }}>
                    Preço / un
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#f97316' }}>
                    Total
                  </th>
                  {order.showDiscountOnPrint && (
                    <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#f97316' }}>
                      Desconto
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {order.quoteTiers!.map((tier, idx) => {
                  const discountPct = maxPrice > 0
                    ? ((maxPrice - tier.unitPrice) / maxPrice * 100)
                    : 0
                  const isBase = idx === 0
                  return (
                    <tr key={tier.qty} style={{
                      borderBottom: '1px solid #f0f0f0',
                      background: isBase ? '#fffbf7' : '#fff',
                    }}>
                      <td style={{ padding: '12px 14px', fontWeight: isBase ? 700 : 500 }}>
                        {tier.qty} unidades
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        {fmt(tier.unitPrice)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#f97316' }}>
                        {fmt(tier.qty * tier.unitPrice)}
                      </td>
                      {order.showDiscountOnPrint && (
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {discountPct > 0 ? (
                            <span style={{
                              background: '#dcfce7', color: '#16a34a', fontSize: 12,
                              fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                            }}>
                              -{discountPct.toFixed(0)}%
                            </span>
                          ) : (
                            <span style={{ color: '#ccc', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Simple item list if no quote tiers */
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Itens</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#fff7ed', borderBottom: '2px solid #f97316' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#f97316' }}>Item</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#f97316' }}>Qtd</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#f97316' }}>Preço/un</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#f97316' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 500 }}>{item.productName}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{item.quantity}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(item.unitPrice)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#f97316' }}>
                      {fmt(item.quantity * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div style={{
            background: '#fafafa', border: '1px solid #e5e5e5',
            borderRadius: 8, padding: '14px 18px', marginBottom: 32,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Observações</div>
            <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6 }}>{order.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#bbb' }}>
            Orçamento válido por 30 dias · {today}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f97316', letterSpacing: 1 }}>
            Filametry
          </div>
        </div>
      </div>
    </>
  )
}
