import { abtn, Badge, Card, EmptyState, Notice, PageHeader } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { requireAdmin } from "@/lib/auth/guard";
import { whatsappUrl } from "@/lib/contact";
import { formatDateEn } from "@/lib/dates";
import { LEAD_TTL_DAYS, listLeads } from "@/lib/leads";
import { formatTaka } from "@/lib/money";
import { LeadActions } from "./LeadActions";

export const metadata = { title: "Incomplete orders" };

export default async function LeadsPage() {
  await requireAdmin();
  const leads = await listLeads();
  const open = leads.filter((l) => !l.contactedAt).length;

  return (
    <>
      <PageHeader
        title="Incomplete orders"
        description={`${open} not contacted yet · ${leads.length} in total`}
      />
      <div className="mb-4">
        <Notice tone="info">
          People who entered a valid phone number at checkout but did not place the order. A call often helps them finish. Each
          one disappears when that number places an order, and after {LEAD_TTL_DAYS} days.
        </Notice>
      </div>
      <Card padded={false}>
        {leads.length === 0 ? (
          <EmptyState icon="checkCircle" title="No incomplete orders" />
        ) : (
          <ul className="divide-y divide-line">
            {leads.map((l) => {
              const wa = whatsappUrl(l.mobileNumber);
              return (
                <li key={l.id} className={l.contactedAt ? "bg-paper/60 px-4 py-4 sm:px-5" : "px-4 py-4 sm:px-5"}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {l.customerName || <span className="font-normal text-muted">No name given</span>}
                        {l.district && <span className="font-normal text-muted"> · {l.district}</span>}
                      </p>
                      <p className="font-mono text-sm text-ink-soft">{l.mobileNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink tabular-nums">{formatTaka(l.subtotal)}</p>
                      <p className="text-xs text-muted">{formatDateEn(l.updatedAt)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">{l.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a href={`tel:${l.mobileNumber}`} className={`${abtn.secondary} ${abtn.sm}`}>
                      <Icon name="phone" className="size-4" /> Call
                    </a>
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className={`${abtn.secondary} ${abtn.sm}`}>
                        <Icon name="whatsapp" className="size-4 text-emerald-600" /> WhatsApp
                      </a>
                    )}
                    {l.contactedAt && (
                      <Badge tone="green">
                        Contacted{l.contactedBy ? ` by ${l.contactedBy}` : ""} · {formatDateEn(l.contactedAt)}
                      </Badge>
                    )}
                    <span className="sm:ml-auto">
                      <LeadActions id={l.id} contacted={!!l.contactedAt} name={l.customerName} />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
