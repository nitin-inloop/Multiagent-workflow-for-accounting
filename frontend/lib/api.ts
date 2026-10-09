import type {
  DemoInvoiceSummary,
  DocumentStats,
  EmailNotification,
  ExportArtifact,
  HealthReport,
  InfoRequestResult,
  InvoiceDocument,
  ReminderDraft,
  ReviewPayload,
} from './types';

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, `Cannot reach the LedgerFlow API at ${API_BASE}.`);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string; details?: unknown } }
      | null;
    throw new ApiError(
      response.status,
      payload?.error?.message ?? `Request failed with status ${response.status}.`,
      payload?.error?.details,
    );
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => request<HealthReport>('/health'),

  listDocuments: () =>
    request<{ documents: InvoiceDocument[]; stats: DocumentStats }>('/api/documents'),

  getDocument: (id: string) =>
    request<{ document: InvoiceDocument; previewUrl: string | null; previewPath: string }>(
      `/api/documents/${id}`,
    ),

  demoInvoices: () =>
    request<{ demoInvoices: DemoInvoiceSummary[] }>('/api/documents/demo-invoices'),

  uploadFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ document: InvoiceDocument }>('/api/documents/upload', {
      method: 'POST',
      body: form,
    });
  },

  useDemoInvoice: (slug: string) =>
    request<{ document: InvoiceDocument }>('/api/documents/demo', {
      method: 'POST',
      body: JSON.stringify({ slug }),
    }),

  reprocess: (id: string) =>
    request<{ document: InvoiceDocument }>(`/api/documents/${id}/process`, { method: 'POST' }),

  review: (id: string, payload: ReviewPayload) =>
    request<{ document: InvoiceDocument; notification: EmailNotification | null }>(
      `/api/documents/${id}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  requestInfo: (id: string, senderName: string) =>
    request<{ document: InvoiceDocument; request: InfoRequestResult }>(
      `/api/documents/${id}/request-info`,
      { method: 'POST', body: JSON.stringify({ senderName }) },
    ),

  exportCsv: (id: string, actor: string) =>
    request<{ document: InvoiceDocument; export: ExportArtifact }>(
      `/api/documents/${id}/export/csv`,
      { method: 'POST', body: JSON.stringify({ actor }) },
    ),

  exportTally: (id: string, actor: string) =>
    request<{ document: InvoiceDocument; export: ExportArtifact }>(
      `/api/documents/${id}/export/tally`,
      { method: 'POST', body: JSON.stringify({ actor }) },
    ),

  reminder: (id: string, senderName: string) =>
    request<{ document: InvoiceDocument; reminder: ReminderDraft }>(
      `/api/documents/${id}/reminder`,
      { method: 'POST', body: JSON.stringify({ senderName }) },
    ),
};

export function fileUrl(previewPath: string): string {
  return `${API_BASE}${previewPath}`;
}

/** Triggers a browser download for a generated export. */
export function downloadArtifact(artifact: ExportArtifact): void {
  const blob = new Blob([artifact.body], { type: artifact.contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
