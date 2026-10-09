import type { InvoiceDocument } from '../types/document.js';
import { roundTo2, sumNullable } from '../utils/money.js';

export interface ExportArtifact {
  fileName: string;
  contentType: string;
  body: string;
}

/**
 * Accounting exports. Both formats are generated from approved documents only;
 * the route layer enforces that. Nothing here writes to Tally directly - the
 * accountant imports the file, which keeps a human in the loop.
 */

const CSV_COLUMNS = [
  'Voucher Type',
  'Voucher Date',
  'Supplier Invoice No',
  'Supplier Name',
  'Supplier GSTIN',
  'Place of Supply',
  'Item',
  'HSN',
  'Quantity',
  'Rate',
  'Amount',
  'Taxable Value',
  'CGST',
  'SGST',
  'IGST',
  'Invoice Total',
  'LedgerFlow Document Id',
  'Approved By',
] as const;

export function toAccountingCsv(document: InvoiceDocument): ExportArtifact {
  const f = document.fields;
  const approver = lastApprover(document);
  const taxable = f.subTotal ?? lineItemsTotal(document) ?? '';

  const base = [
    'Purchase',
    f.invoiceDate ?? '',
    f.invoiceNumber ?? '',
    f.vendorName ?? '',
    f.gstin ?? '',
    f.placeOfSupply ?? '',
  ];

  const rows: string[][] = [];

  if (f.lineItems.length === 0) {
    rows.push([
      ...base,
      'Invoice value',
      '',
      '',
      '',
      String(f.total ?? ''),
      String(taxable),
      String(f.tax.cgst ?? ''),
      String(f.tax.sgst ?? ''),
      String(f.tax.igst ?? ''),
      String(f.total ?? ''),
      document.documentId,
      approver,
    ]);
  } else {
    f.lineItems.forEach((item, index) => {
      const firstRow = index === 0;
      rows.push([
        ...base,
        item.name,
        item.hsn ?? '',
        item.quantity === null ? '' : String(item.quantity),
        item.rate === null ? '' : String(item.rate),
        item.amount === null ? '' : String(item.amount),
        // Tax and totals belong to the voucher, not the line, so they appear once.
        firstRow ? String(taxable) : '',
        firstRow ? String(f.tax.cgst ?? '') : '',
        firstRow ? String(f.tax.sgst ?? '') : '',
        firstRow ? String(f.tax.igst ?? '') : '',
        firstRow ? String(f.total ?? '') : '',
        document.documentId,
        firstRow ? approver : '',
      ]);
    });
  }

  const body = [CSV_COLUMNS.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');

  return {
    fileName: `ledgerflow-${slug(f.invoiceNumber ?? document.documentId)}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body: `${body}\r\n`,
  };
}

/**
 * Tally Prime import format: a Purchase voucher with the supplier ledger
 * credited and the purchase plus GST ledgers debited. Amounts follow Tally's
 * sign convention, where a debit is negative in the XML payload.
 */
export function toTallyXml(document: InvoiceDocument): ExportArtifact {
  const f = document.fields;
  const taxable = f.subTotal ?? lineItemsTotal(document) ?? 0;
  const total = f.total ?? roundTo2(taxable + (sumNullable([f.tax.cgst, f.tax.sgst, f.tax.igst]) ?? 0));
  const vendor = f.vendorName ?? 'Unknown Supplier';
  const voucherDate = (f.invoiceDate ?? document.createdAt.slice(0, 10)).replace(/-/g, '');
  const guid = `ledgerflow-${document.documentId}`;

  const taxLedgers: Array<{ name: string; amount: number }> = [];
  if (f.tax.cgst) taxLedgers.push({ name: 'Input CGST', amount: f.tax.cgst });
  if (f.tax.sgst) taxLedgers.push({ name: 'Input SGST', amount: f.tax.sgst });
  if (f.tax.igst) taxLedgers.push({ name: 'Input IGST', amount: f.tax.igst });

  const inventoryEntries = f.lineItems
    .filter((item) => item.amount !== null || (item.quantity !== null && item.rate !== null))
    .map((item) => {
      const amount = item.amount ?? roundTo2((item.quantity ?? 0) * (item.rate ?? 0));
      return `        <ALLINVENTORYENTRIES.LIST>
          <STOCKITEMNAME>${xml(item.name)}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <RATE>${item.rate === null ? '' : `${item.rate}/Nos`}</RATE>
          <ACTUALQTY>${item.quantity === null ? '' : `${item.quantity} Nos`}</ACTUALQTY>
          <BILLEDQTY>${item.quantity === null ? '' : `${item.quantity} Nos`}</BILLEDQTY>
          <AMOUNT>-${amount}</AMOUNT>
          ${item.hsn ? `<HSNCODE>${xml(item.hsn)}</HSNCODE>` : ''}
          <ACCOUNTINGALLOCATIONS.LIST>
            <LEDGERNAME>Purchase Accounts</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${amount}</AMOUNT>
          </ACCOUNTINGALLOCATIONS.LIST>
        </ALLINVENTORYENTRIES.LIST>`;
    })
    .join('\n');

  const purchaseLedger =
    inventoryEntries.length > 0
      ? ''
      : `        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Purchase Accounts</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${taxable}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;

  const taxEntries = taxLedgers
    .map(
      (ledger) => `        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xml(ledger.name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${ledger.amount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`,
    )
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${xml(document.orgId)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${voucherDate}</DATE>
            <GUID>${xml(guid)}</GUID>
            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
            <REFERENCE>${xml(f.invoiceNumber ?? document.documentId)}</REFERENCE>
            <REFERENCEDATE>${voucherDate}</REFERENCEDATE>
            <PARTYLEDGERNAME>${xml(vendor)}</PARTYLEDGERNAME>
            <PARTYGSTIN>${xml(f.gstin ?? '')}</PARTYGSTIN>
            <PLACEOFSUPPLY>${xml(f.placeOfSupply ?? '')}</PLACEOFSUPPLY>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <NARRATION>${xml(
              `Imported from LedgerFlow. Document ${document.documentId}. Approved by ${lastApprover(document)}.`,
            )}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xml(vendor)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${total}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
${[purchaseLedger, taxEntries].filter((part) => part.length > 0).join('\n')}
${inventoryEntries}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
`;

  return {
    fileName: `ledgerflow-${slug(f.invoiceNumber ?? document.documentId)}.xml`,
    contentType: 'application/xml; charset=utf-8',
    body,
  };
}

function lineItemsTotal(document: InvoiceDocument): number | null {
  return sumNullable(
    document.fields.lineItems.map((item) =>
      item.amount !== null
        ? item.amount
        : item.quantity !== null && item.rate !== null
          ? roundTo2(item.quantity * item.rate)
          : null,
    ),
  );
}

function lastApprover(document: InvoiceDocument): string {
  const approval = [...document.audit].reverse().find((event) => event.action === 'APPROVED');
  return approval?.actor ?? 'Unapproved';
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'invoice';
}
