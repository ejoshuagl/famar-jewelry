import { MessageCircle, ShieldCheck, Truck } from 'lucide-react'

const CONFIDENCE_ITEMS = [
  { icon: ShieldCheck, label: 'Compra segura' },
  { icon: Truck, label: 'Envíos nacionales' },
  { icon: MessageCircle, label: 'Confirmación personal' },
]

export function PurchaseConfidence({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid grid-cols-3 gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] ${compact ? 'p-2' : 'p-3'}`} aria-label="Beneficios de compra">
      {CONFIDENCE_ITEMS.map(({ icon: Icon, label }) => (
        <div key={label} className="flex min-w-0 flex-col items-center gap-1 text-center">
          <Icon className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-primary`} aria-hidden="true" />
          <span className={`${compact ? 'text-[10px]' : 'text-[11px] sm:text-xs'} leading-tight text-muted-foreground`}>{label}</span>
        </div>
      ))}
    </div>
  )
}
