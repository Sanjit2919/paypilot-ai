import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { loadLedger, toBusinessDTO, toInvoiceDTO } from "@/lib/finance";

export async function getSharedInvoice(token: string) {
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(token)) return null;
  const [row] = await db.select().from(invoices).where(eq(invoices.shareToken, token)).limit(1);
  if (!row) return null;
  const ledger = await loadLedger(row.userId);
  if (!ledger) return null;
  const source = ledger.invoices.find((invoice) => invoice.id === row.id);
  if (!source) return null;
  const client = ledger.clients.find((item) => item.id === row.clientId);
  return {
    business: toBusinessDTO(ledger.business),
    invoice: toInvoiceDTO(ledger, source),
    clientEmail: client?.email ?? "",
    clientAddress: client?.address ?? "",
  };
}
