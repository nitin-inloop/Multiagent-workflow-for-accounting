import type { InvoiceFields } from '../types/document.js';
import { invoiceFieldsSchema } from '../types/document.js';

/**
 * Hardcoded demo invoices. These exist so a presentation never depends on live
 * OCR: every one of them is a realistic Bhopal-area supplier bill, and between
 * them they trigger each exception the review queue is built to handle.
 */
export interface DemoInvoice {
  slug: string;
  fileName: string;
  /** What this sample is meant to demonstrate, shown in the upload panel. */
  headline: string;
  teaches: string;
  confidence: number;
  fields: InvoiceFields;
}

const invoice = (fields: Partial<InvoiceFields>): InvoiceFields => invoiceFieldsSchema.parse(fields);

export const DEMO_INVOICES: DemoInvoice[] = [
  {
    slug: 'gstin-missing',
    fileName: 'shreeram-traders-inv-189.jpg',
    headline: 'Shree Ram Traders - GSTIN missing',
    teaches: 'The scan is clean but the vendor GSTIN never made it onto the bill.',
    confidence: 0.86,
    fields: invoice({
      vendorName: 'Shree Ram Traders',
      gstin: null,
      invoiceNumber: 'INV-189',
      invoiceDate: '2026-08-11',
      placeOfSupply: 'Govindpura, Bhopal, Madhya Pradesh',
      lineItems: [
        { name: 'TMT Steel Rod 12mm', quantity: 10, rate: 250, amount: 2500, hsn: '7214' },
      ],
      subTotal: 2500,
      tax: { cgst: 225, sgst: 225, igst: null },
      total: 2950,
      hasSignature: true,
    }),
  },
  {
    slug: 'total-mismatch',
    fileName: 'mandideep-polymers-mp-4471.jpg',
    headline: 'Mandideep Polymers - total does not add up',
    teaches: 'Taxable value plus GST comes to Rs. 47,200 but the bill footer says Rs. 47,000.',
    confidence: 0.91,
    fields: invoice({
      vendorName: 'Mandideep Polymers Pvt Ltd',
      gstin: '23AABCM1234K1ZU',
      invoiceNumber: 'MP/26-27/4471',
      invoiceDate: '2026-08-14',
      placeOfSupply: 'Mandideep, Raisen, Madhya Pradesh',
      lineItems: [
        { name: 'HDPE Granules 25kg bag', quantity: 20, rate: 1450, amount: 29000, hsn: '3901' },
        { name: 'PP Woven Sacks', quantity: 500, rate: 22, amount: 11000, hsn: '6305' },
      ],
      subTotal: 40000,
      tax: { cgst: 3600, sgst: 3600, igst: null },
      total: 47000,
      hasSignature: true,
    }),
  },
  {
    slug: 'clean-intrastate',
    fileName: 'arera-stationers-as-2211.jpg',
    headline: 'Arera Stationers - clean invoice',
    teaches: 'Everything reconciles, so it skips the queue and lands in ready for approval.',
    confidence: 0.96,
    fields: invoice({
      vendorName: 'Arera Stationers',
      gstin: '23AAGCA5678M1Z9',
      invoiceNumber: 'AS-2211',
      invoiceDate: '2026-08-18',
      placeOfSupply: 'Arera Colony, Bhopal, Madhya Pradesh',
      lineItems: [
        { name: 'A4 Copier Paper 75 GSM (ream)', quantity: 40, rate: 265, amount: 10600, hsn: '4802' },
        { name: 'Box File', quantity: 25, rate: 96, amount: 2400, hsn: '4820' },
      ],
      subTotal: 13000,
      tax: { cgst: 1170, sgst: 1170, igst: null },
      total: 15340,
      hasSignature: true,
    }),
  },
  {
    slug: 'igst-interstate',
    fileName: 'pune-bearings-pb-8890.jpg',
    headline: 'Pune Bearings - interstate IGST bill',
    teaches: 'A Maharashtra supplier charging IGST, with a faint unsigned footer.',
    confidence: 0.72,
    fields: invoice({
      vendorName: 'Pune Bearings & Components',
      gstin: '27AACCP9012Q1ZY',
      invoiceNumber: 'PB/8890',
      invoiceDate: '2026-08-09',
      placeOfSupply: 'Bhopal, Madhya Pradesh',
      lineItems: [
        { name: 'Taper Roller Bearing 30206', quantity: 60, rate: 310, amount: 18600, hsn: '8482' },
        { name: 'Grease Cartridge 400g', quantity: 12, rate: 195, amount: 2340, hsn: '2710' },
      ],
      subTotal: 20940,
      tax: { cgst: null, sgst: null, igst: 3769.2 },
      total: 24709.2,
      hasSignature: false,
    }),
  },
  {
    slug: 'faded-thermal',
    fileName: 'hoshangabad-road-hardware-hh-77.jpg',
    headline: 'Hoshangabad Road Hardware - faded thermal print',
    teaches: 'Low-confidence OCR: the invoice number and total came through, the rest did not.',
    confidence: 0.58,
    fields: invoice({
      vendorName: 'Hoshangabad Road Hardware',
      gstin: null,
      invoiceNumber: 'HH-77',
      invoiceDate: null,
      placeOfSupply: 'Hoshangabad Road, Bhopal',
      lineItems: [{ name: 'Assorted fasteners', quantity: null, rate: null, amount: null, hsn: null }],
      subTotal: null,
      tax: { cgst: null, sgst: null, igst: null },
      total: 1860,
      hasSignature: false,
    }),
  },
  {
    slug: 'duplicate-resend',
    fileName: 'shreeram-traders-inv-189-resend.jpg',
    headline: 'Shree Ram Traders - same bill resent on WhatsApp',
    teaches: 'Same vendor and invoice number as INV-189, caught as a duplicate.',
    confidence: 0.88,
    fields: invoice({
      vendorName: 'Shree Ram Traders',
      gstin: '23AAFCS4321L1ZG',
      invoiceNumber: 'INV-189',
      invoiceDate: '2026-08-11',
      placeOfSupply: 'Govindpura, Bhopal, Madhya Pradesh',
      lineItems: [
        { name: 'TMT Steel Rod 12mm', quantity: 10, rate: 250, amount: 2500, hsn: '7214' },
      ],
      subTotal: 2500,
      tax: { cgst: 225, sgst: 225, igst: null },
      total: 2950,
      hasSignature: true,
    }),
  },
];

export function findDemoInvoice(slug: string): DemoInvoice | undefined {
  return DEMO_INVOICES.find((entry) => entry.slug === slug);
}

/**
 * Picks a demo invoice from a file hash so an arbitrary uploaded image always
 * produces the same fallback result. Deterministic beats random when you are
 * demonstrating the same file twice.
 */
export function demoInvoiceForHash(fileHash: string): DemoInvoice {
  const numeric = Number.parseInt(fileHash.slice(0, 8), 16);
  const usable = DEMO_INVOICES.filter((entry) => entry.slug !== 'duplicate-resend');
  const index = Number.isNaN(numeric) ? 0 : numeric % usable.length;
  return usable[index] as DemoInvoice;
}
