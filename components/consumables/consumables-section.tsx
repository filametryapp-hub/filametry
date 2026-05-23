'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Check, X, FlaskConical } from 'lucide-react'
import { getConsumables, addConsumable, updateConsumable, deleteConsumable, type ConsumableRow } from '@/lib/actions/consumables'
import { CurrencyInput } from '@/components/ui/currency-input'
import { useT } from '@/lib/i18n'

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition-colors placeholder:text-muted-foreground'
const COMMON_UNITS = ['ml', 'g', 'folha', 'un', 'cm', 'm', 'dose']

export function ConsumablesSection() {
  const { fmtCurrency } = useT()
  const [items, setItems]   = useState<ConsumableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [editId, setEditId]   = useState<string | null>(null)
  const [form, setForm]       = useState({ name: '', unit: 'ml', cost_per_unit: 0, notes: '' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    getConsumables().then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function resetForm() { setForm({ name: '', unit: 'ml', cost_per_unit: 0, notes: '' }); setError('') }

  async function handleAdd() {
    if (!form.name.trim()) { setError('Nome obrigatório.'); return }
    if (form.cost_per_unit <= 0) { setError('Custo deve ser > 0.'); return }
    setSaving(true); setError('')
    try {
      const created = await addConsumable({ name: form.name.trim(), unit: form.unit, cost_per_unit: form.cost_per_unit, notes: form.notes.trim() || undefined })
      setItems(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      resetForm(); setAdding(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  async function handleUpdate(id: string) {
    if (!form.name.trim()) { setError('Nome obrigatório.'); return }
    setSaving(true); setError('')
    try {
      await updateConsumable(id, { name: form.name.trim(), unit: form.unit, cost_per_unit: form.cost_per_unit, notes: form.notes.trim() || undefined })
      setItems(prev => prev.map(i => i.id === id ? { ...i, name: form.name.trim(), unit: form.unit, cost_per_unit: form.cost_per_unit, notes: form.notes || null } : i).sort((a, b) => a.name.localeCompare(b.name)))
      setEditId(null); resetForm()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await deleteConsumable(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function startEdit(item: ConsumableRow) {
    setEditId(item.id)
    setForm({ name: item.name, unit: item.unit, cost_per_unit: item.cost_per_unit, notes: item.notes ?? '' })
    setAdding(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Verniz, lixa, primer, tinta e outros materiais de acabamento.
        </p>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setEditId(null); resetForm() }}
            className="flex items-center gap-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            <Plus className="size-4" /> Novo material
          </button>
        )}
      </div>

      {adding && (
        <ConsumableForm form={form} setForm={setForm} error={error} saving={saving}
          onSave={handleAdd} onCancel={() => { setAdding(false); resetForm() }} title="Novo consumível" />
      )}

      {items.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center space-y-2">
          <FlaskConical className="size-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">Nenhum material cadastrado</p>
          <p className="text-xs text-muted-foreground">Adicione verniz, lixa, primer e outros materiais de acabamento.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {items.map(item => (
            <div key={item.id}>
              {editId === item.id ? (
                <div className="p-4">
                  <ConsumableForm form={form} setForm={setForm} error={error} saving={saving}
                    onSave={() => handleUpdate(item.id)} onCancel={() => { setEditId(null); resetForm() }}
                    title={`Editar: ${item.name}`} />
                </div>
              ) : (
                <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors group">
                  <div className="p-2 rounded-lg bg-blue-600/10 shrink-0">
                    <FlaskConical className="size-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.notes && <p className="text-xs text-muted-foreground truncate">{item.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-semibold text-blue-600">
                      {fmtCurrency(item.cost_per_unit)}<span className="text-muted-foreground font-normal text-xs">/{item.unit}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(item)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? 'material cadastrado' : 'materiais cadastrados'}
        </p>
      )}
    </div>
  )
}

function ConsumableForm({ form, setForm, error, saving, onSave, onCancel, title }: {
  form: { name: string; unit: string; cost_per_unit: number; notes: string }
  setForm: React.Dispatch<React.SetStateAction<typeof form>>
  error: string; saving: boolean; onSave: () => void; onCancel: () => void; title: string
}) {
  return (
    <div className="rounded-xl border border-blue-600/30 bg-blue-600/5 p-4 space-y-3">
      <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Nome *</label>
          <input className={INPUT + ' mt-1'} value={form.name} autoFocus
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="ex: Verniz acrílico, Lixa 220, Primer" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Unidade</label>
          <div className="mt-1 flex gap-1.5 flex-wrap">
            {COMMON_UNITS.map(u => (
              <button key={u} type="button" onClick={() => setForm(f => ({ ...f, unit: u }))}
                className={`px-2 py-1 rounded text-xs border transition-colors ${form.unit === u ? 'bg-blue-600 border-blue-600 text-white font-medium' : 'border-border text-muted-foreground hover:border-blue-600/50'}`}>
                {u}
              </button>
            ))}
            {!COMMON_UNITS.includes(form.unit) && (
              <span className="px-2 py-1 rounded text-xs border bg-blue-600 border-blue-600 text-white font-medium">{form.unit}</span>
            )}
            <input className="px-2 py-1 rounded text-xs border border-dashed border-border bg-background text-muted-foreground w-16 focus:outline-none focus:border-blue-600"
              placeholder="outro" onFocus={e => e.target.select()}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value || 'un' }))} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Custo por {form.unit} *</label>
          <CurrencyInput value={form.cost_per_unit} onChange={v => setForm(f => ({ ...f, cost_per_unit: v }))} className={INPUT + ' mt-1'} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Observações (opcional)</label>
          <input className={INPUT + ' mt-1'} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="marca, referência, local de compra…" />
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors">
          <X className="size-3.5" /> Cancelar
        </button>
        <button type="button" onClick={onSave} disabled={saving}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium transition-colors">
          <Check className="size-3.5" /> {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
