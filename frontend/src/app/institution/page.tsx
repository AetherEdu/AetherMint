import type { Metadata } from 'next';
import InstitutionClient from './InstitutionClient';

export const metadata: Metadata = {
  title: 'Institution Workspace',
  description:
    'Provision and manage isolated institution workspaces, members, and scoped credential issuance.',
  alternates: {
    canonical: '/institution',
  },
};

export default function InstitutionPage() {
  return <InstitutionClient />;
}
