import type { Metadata } from 'next';
import { DesktopWorkbench } from './workbench';

export const metadata: Metadata = {
  title: 'Stampbench Desktop',
  description: 'Local-first desktop workbench for inspecting EN 16931 and XRechnung invoices.',
};

export default function DesktopPage() {
  return <DesktopWorkbench />;
}
