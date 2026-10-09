import { FileSpreadsheet, HardDrive, Mail, MessageCircle, Table2 } from 'lucide-react';

/**
 * Where documents will arrive from, and where entries will go. These are named
 * as upcoming on purpose: the working upload-review-export path is the proof,
 * and pretending an OAuth flow exists would be the wrong kind of demo.
 */
const CONNECTORS = [
  { name: 'WhatsApp Business', icon: MessageCircle, direction: 'in', state: 'After pilot' },
  { name: 'Gmail', icon: Mail, direction: 'in', state: 'After pilot' },
  { name: 'Google Drive', icon: HardDrive, direction: 'in', state: 'After pilot' },
  { name: 'Tally Prime', icon: Table2, direction: 'out', state: 'XML today, direct post later' },
  { name: 'Zoho Books', icon: FileSpreadsheet, direction: 'out', state: 'After pilot' },
] as const;

export function ConnectorRail() {
  return (
    <section aria-labelledby="connectors" className="rule-t bg-paper-raised">
      <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8">
        <h2 id="connectors" className="eyebrow">
          Connectors
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
          Bills arrive on WhatsApp and Gmail today, and someone forwards them by hand. These
          connectors close that gap. Tally export works now, as a file the accountant imports —
          nothing writes into the books without an approval.
        </p>

        <ul className="mt-5 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-5">
          {CONNECTORS.map((connector) => (
            <li key={connector.name} className="bg-paper px-4 py-3.5">
              <div className="flex items-center gap-2">
                <connector.icon aria-hidden className="h-3.5 w-3.5 text-ink-faint" />
                <span className="font-display text-[13.5px] font-medium text-ink">
                  {connector.name}
                </span>
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                {connector.direction === 'in' ? 'Inbound' : 'Outbound'} · {connector.state}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
