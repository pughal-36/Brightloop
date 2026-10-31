import { notFound } from "next/navigation";
import { requireSession } from "@/server/lib/session";
import { getInvoice } from "@/server/modules/invoices";
import { formatINR } from "@/lib/money";
import { InvoiceLineKind } from "@/generated/prisma/enums";
import { PrintButton } from "./print-button";

interface PrintInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function PrintInvoicePage({ params }: PrintInvoicePageProps) {
  const session = await requireSession();
  const { id } = await params;

  let invoice;
  try {
    invoice = await getInvoice(session, id);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 p-8 max-w-4xl mx-auto">
      {/* Print Controls (hidden when printing) */}
      <div className="print:hidden flex justify-between items-center mb-8 pb-4 border-b">
        <span className="text-sm text-zinc-500">
          Print Preview: <strong className="font-mono text-zinc-900">{invoice.number}</strong>
        </span>
        <PrintButton />
      </div>

      {/* Invoice Document */}
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
              BrightLoop
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              B2B Subscription Management &amp; Billing
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold font-mono text-zinc-900">
              {invoice.number}
            </h2>
            <div className="inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border border-zinc-300">
              {invoice.status}
            </div>
          </div>
        </div>

        {/* Addresses & Dates Grid */}
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <h3 className="font-semibold text-zinc-700 uppercase tracking-wider text-xs mb-1">
              Billed To
            </h3>
            <p className="font-bold text-zinc-900 text-base">{invoice.customer.name}</p>
            <p className="text-zinc-600">{invoice.customer.email}</p>
            {invoice.customer.billingAddress && (
              <p className="text-zinc-600 whitespace-pre-line mt-1">
                {invoice.customer.billingAddress}
              </p>
            )}
          </div>

          <div className="text-right space-y-1 text-sm">
            <div>
              <span className="text-zinc-500 mr-2">Issue Date:</span>
              <span className="font-medium">
                {new Date(invoice.issueDate).toISOString().split("T")[0]}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 mr-2">Due Date:</span>
              <span className="font-medium">
                {new Date(invoice.dueDate).toISOString().split("T")[0]}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 mr-2">Billing Period:</span>
              <span className="font-medium">
                {new Date(invoice.periodStart).toISOString().split("T")[0]} to{" "}
                {new Date(invoice.periodEnd).toISOString().split("T")[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-xs uppercase text-zinc-600">
              <tr>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5 text-right">Qty</th>
                <th className="px-4 py-2.5 text-right">Unit Price</th>
                <th className="px-4 py-2.5 text-right">Tax Rate</th>
                <th className="px-4 py-2.5 text-right">Tax</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {invoice.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-medium">
                    {l.description}
                    {l.kind === InvoiceLineKind.PLAN_FEE && (
                      <span className="ml-2 text-[10px] text-zinc-500 border px-1 rounded">
                        PLAN
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{l.qty}</td>
                  <td className="px-4 py-3 text-right">
                    {l.kind === InvoiceLineKind.DISCOUNT ? "-" : formatINR(l.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-zinc-500">
                    {(l.taxRateBps / 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right">{formatINR(l.taxAmount)}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatINR(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal:</span>
              <span>{formatINR(invoice.subtotal)}</span>
            </div>
            {invoice.discountTotal > 0 && (
              <div className="flex justify-between text-zinc-900 font-medium">
                <span>Discount:</span>
                <span>-{formatINR(invoice.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-600">
              <span>Tax Total:</span>
              <span>{formatINR(invoice.taxTotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-zinc-900 pt-2 text-zinc-900">
              <span>Total:</span>
              <span>{formatINR(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-zinc-600 text-xs">
              <span>Amount Paid:</span>
              <span>{formatINR(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-dashed border-zinc-400 pt-1">
              <span>Balance Due:</span>
              <span>{formatINR(invoice.balance)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500">
          <p>Thank you for your business. For billing inquiries, contact billing@brightloop.io.</p>
        </div>
      </div>
    </div>
  );
}
