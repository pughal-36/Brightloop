import { notFound } from "next/navigation";
import { requireSession } from "@/server/lib/session";
import { getMyInvoice } from "@/server/modules/portal";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { PrintButton } from "@/app/admin/invoices/[id]/print/print-button";
import { AppError } from "@/server/errors";

interface PrintInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalPrintInvoicePage({ params }: PrintInvoicePageProps) {
  const session = await requireSession();
  const { id } = await params;

  let invoice;
  try {
    const data = await getMyInvoice(session, id);
    invoice = data.invoice;
  } catch (err) {
    if (err instanceof AppError && (err.status === 404 || err.code === "NOT_FOUND")) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 p-8 max-w-4xl mx-auto font-sans">
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
            {invoice.customer.email && (
              <p className="text-zinc-600">{invoice.customer.email}</p>
            )}
            {invoice.customer.phone && (
              <p className="text-zinc-600">{invoice.customer.phone}</p>
            )}
            {invoice.customer.billingAddress && (
              <p className="text-zinc-600 mt-1 whitespace-pre-line">
                {invoice.customer.billingAddress}
              </p>
            )}
          </div>
          <div className="text-right space-y-1.5">
            <div>
              <span className="text-zinc-500 text-xs uppercase tracking-wider block">Issue Date</span>
              <span className="font-medium">{formatDate(invoice.issueDate)}</span>
            </div>
            <div>
              <span className="text-zinc-500 text-xs uppercase tracking-wider block">Due Date</span>
              <span className="font-medium">{formatDate(invoice.dueDate)}</span>
            </div>
            <div>
              <span className="text-zinc-500 text-xs uppercase tracking-wider block">Billing Period</span>
              <span className="font-medium">
                {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 text-xs uppercase tracking-wider block">Subscription Ref</span>
              <span className="font-mono font-medium">{invoice.subscription.number}</span>
            </div>
          </div>
        </div>

        {/* Lines Table */}
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 border-b text-xs uppercase font-semibold text-zinc-600">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y text-zinc-800">
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 font-medium">{line.description}</td>
                  <td className="px-4 py-3 text-center font-mono">{line.qty}</td>
                  <td className="px-4 py-3 text-right">{formatINR(line.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(line.taxAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatINR(line.amount + line.taxAmount)}
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
              <span className="font-medium text-zinc-900">{formatINR(invoice.subtotal)}</span>
            </div>
            {invoice.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount:</span>
                <span>-{formatINR(invoice.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-600">
              <span>Taxes:</span>
              <span className="font-medium text-zinc-900">{formatINR(invoice.taxTotal)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-base text-zinc-900">
              <span>Total:</span>
              <span>{formatINR(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Amount Paid:</span>
              <span className="font-medium text-zinc-900">{formatINR(invoice.amountPaid)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-base text-zinc-900">
              <span>Balance Due:</span>
              <span>{formatINR(invoice.balance)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-8 text-center text-xs text-zinc-400 space-y-1">
          <p>Thank you for your business with BrightLoop.</p>
          <p>For questions regarding this statement, please contact your account representative.</p>
        </div>
      </div>
    </div>
  );
}

