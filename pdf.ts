import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import type { BusinessDTO, InvoiceDTO } from "@/lib/types";

const NAVY = rgb(0.063, 0.094, 0.157);
const BLUE = rgb(0.22, 0.404, 1);
const GREY = rgb(0.42, 0.45, 0.52);
const LIGHT = rgb(0.94, 0.95, 0.97);

function safePdfText(value: string): string {
  return value
    .replaceAll("₹", "INR ").replaceAll("€", "EUR ").replaceAll("£", "GBP ")
    .replaceAll("¥", "JPY ").replaceAll("د.إ", "AED ")
    .replace(/[–—]/g, "-").replace(/[•·]/g, "|").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
}

type PdfInvoiceInput = {
  business: BusinessDTO;
  invoice: InvoiceDTO;
  clientEmail?: string;
  clientAddress?: string;
  paypalLink?: string | null;
};

export async function renderInvoicePdf(input: PdfInvoiceInput): Promise<Uint8Array> {
  const { business, invoice } = input;
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  const text = (
    value: string,
    x: number,
    top: number,
    opts: { size?: number; font?: typeof font; color?: typeof NAVY } = {},
  ) => {
    page.drawText(safePdfText(value), { x, y: top, size: opts.size ?? 10, font: opts.font ?? font, color: opts.color ?? NAVY });
  };

  page.drawRectangle({ x: 0, y: height - 7, width, height: 7, color: BLUE });
  text(business.name || "Your Business", margin, y, { size: 18, font: bold });
  y -= 16;
  text(`${business.industry} · ${business.country}`, margin, y, { size: 9, color: GREY });
  y -= 26;

  text("INVOICE", margin, y, { size: 22, font: bold, color: BLUE });
  text(invoice.number, width - margin - 110, y + 4, { size: 12, font: bold });
  y -= 18;
  text(`Issued ${formatDate(invoice.issueDate)}`, width - margin - 110, y, { size: 9, color: GREY });
  y -= 12;
  text(`Due ${formatDate(invoice.dueDate)}`, width - margin - 110, y, { size: 9, color: GREY });
  y -= 12;
  text(`Status: ${titleCase(invoice.status)}`, width - margin - 110, y, { size: 9, color: GREY });
  if (business.isDemo) {
    y -= 17;
    text("SAMPLE INVOICE - DEMO DATA - NOT FOR PAYMENT", margin, y, { size: 9, font: bold, color: BLUE });
  }

  y -= 34;
  text("BILLED TO", margin, y, { size: 9, font: bold, color: GREY });
  y -= 14;
  text(invoice.clientName || "Client", margin, y, { size: 12, font: bold });
  y -= 13;
  if (input.clientEmail) {
    text(input.clientEmail, margin, y, { size: 9, color: GREY });
    y -= 12;
  }
  if (input.clientAddress) {
    text(input.clientAddress.slice(0, 70), margin, y, { size: 9, color: GREY });
    y -= 12;
  }

  y -= 12;
  page.drawRectangle({ x: margin, y: y - 6, width: width - margin * 2, height: 22, color: LIGHT });
  text("DESCRIPTION", margin + 8, y, { size: 9, font: bold, color: GREY });
  text("QTY", width - margin - 150, y, { size: 9, font: bold, color: GREY });
  text("UNIT PRICE", width - margin - 105, y, { size: 9, font: bold, color: GREY });
  text("AMOUNT", width - margin - 70, y, { size: 9, font: bold, color: GREY });
  y -= 20;

  for (const item of invoice.items) {
    if (y < 120) break;
    text(item.description.slice(0, 58), margin + 8, y, { size: 10 });
    text(String(item.quantity), width - margin - 148, y, { size: 10, color: GREY });
    text(formatMoney(item.unitPrice, business.currency), width - margin - 108, y, { size: 10, color: GREY });
    text(formatMoney(item.amount, business.currency), width - margin - 70, y, { size: 10, font: bold });
    y -= 16;
  }

  y -= 8;
  page.drawLine({ start: { x: width - margin - 190, y }, end: { x: width - margin, y }, thickness: 0.8, color: LIGHT });
  y -= 16;

  const summaryRow = (label: string, value: string, emphasize = false) => {
    text(label, width - margin - 190, y, { size: 10, color: GREY, font: emphasize ? bold : font });
    text(value, width - margin - 70, y, { size: emphasize ? 12 : 10, font: emphasize ? bold : font });
    y -= emphasize ? 20 : 15;
  };

  summaryRow("Subtotal", formatMoney(invoice.subtotal, business.currency));
  if (invoice.discountValue > 0) {
    summaryRow(
      `Discount (${invoice.discountType === "percent" ? `${invoice.discountValue}%` : "fixed"})`,
      `-${formatMoney(
        invoice.discountType === "percent"
          ? (invoice.subtotal * invoice.discountValue) / 100
          : invoice.discountValue,
        business.currency,
      )}`,
    );
  }
  if (invoice.taxRate > 0) {
    summaryRow(
      `Tax (${invoice.taxRate}%)`,
      formatMoney(Math.max(0, invoice.total - invoice.subtotal + (invoice.discountType === "percent" ? (invoice.subtotal * invoice.discountValue) / 100 : Math.min(invoice.discountValue, invoice.subtotal))), business.currency),
    );
  }
  summaryRow("Total", formatMoney(invoice.total, business.currency), true);
  if (invoice.amountPaid > 0) {
    summaryRow("Amount paid", formatMoney(invoice.amountPaid, business.currency));
    summaryRow("Balance due", formatMoney(invoice.balance, business.currency), true);
  }

  y -= 10;
  if (invoice.notes) {
    text("NOTES", margin, y, { size: 9, font: bold, color: GREY });
    y -= 13;
    const words = invoice.notes.split(" ");
    let line = "";
    for (const word of words) {
      if ((line + word).length > 78) {
        text(line, margin, y, { size: 9, color: GREY });
        y -= 12;
        line = "";
      }
      line += `${word} `;
    }
    if (line) {
      text(line, margin, y, { size: 9, color: GREY });
      y -= 12;
    }
  }

  if (input.paypalLink) {
    y -= 6;
    text("Pay online:", margin, y, { size: 9, font: bold, color: BLUE });
    text(input.paypalLink.slice(0, 90), margin + 60, y, { size: 9, color: BLUE });
  }

  page.drawLine({
    start: { x: margin, y: 60 },
    end: { x: width - margin, y: 60 },
    thickness: 0.8,
    color: LIGHT,
  });
  text(
    `Generated by PayPilot AI · ${business.email || "finance@paypilot.ai"} · This document is a system-generated invoice.`,
    margin,
    44,
    { size: 8, color: GREY },
  );

  return doc.save();
}

export type ReportPdfInput = {
  business: BusinessDTO;
  title: string;
  period: string;
  sections: { heading: string; rows: [string, string][] }[];
  notes?: string[];
};

export async function renderReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  const text = (value: string, x: number, top: number, opts: { size?: number; font?: typeof font; color?: typeof NAVY } = {}) => {
    page.drawText(safePdfText(value), { x, y: top, size: opts.size ?? 10, font: opts.font ?? font, color: opts.color ?? NAVY });
  };

  text("PayPilot AI", margin, y, { size: 11, font: bold, color: BLUE });
  y -= 22;
  text(input.title, margin, y, { size: 20, font: bold });
  y -= 16;
  text(`${input.business.name} · ${input.period}`, margin, y, { size: 10, color: GREY });
  y -= 30;

  for (const section of input.sections) {
    if (y < 90) break;
    text(section.heading.toUpperCase(), margin, y, { size: 10, font: bold, color: BLUE });
    y -= 18;
    for (const [label, value] of section.rows) {
      text(label, margin + 6, y, { size: 10 });
      text(value, width - margin - 130, y, { size: 10, font: bold });
      y -= 15;
    }
    y -= 12;
  }

  if (input.notes?.length) {
    text("NOTES", margin, y, { size: 10, font: bold, color: GREY });
    y -= 15;
    for (const note of input.notes) {
      const words = note.split(" ");
      let line = "";
      for (const word of words) {
        if ((line + word).length > 88) {
          text(line, margin, y, { size: 9, color: GREY });
          y -= 12;
          line = "";
        }
        line += `${word} `;
      }
      if (line) {
        text(line, margin, y, { size: 9, color: GREY });
        y -= 12;
      }
      y -= 2;
    }
  }

  page.drawLine({ start: { x: margin, y: 56 }, end: { x: width - margin, y: 56 }, thickness: 0.8, color: LIGHT });
  text("Generated by PayPilot AI · Estimates are not guarantees of future results.", margin, 40, {
    size: 8,
    color: GREY,
  });

  return doc.save();
}
