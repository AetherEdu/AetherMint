'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  GraduationCap,
  Loader2,
  Plus,
  Send,
  Users,
} from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: string;
  credentialAuthority: {
    issuingEnabled: boolean;
    allowedCredentialTypes: string[];
  };
}

interface Member {
  id: string;
  email: string;
  role: string;
  status: string;
}

const ROLES = ['owner', 'admin', 'instructor', 'registrar'] as const;

function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!configured) return '';
  return configured.replace(/\/$/, '');
}

export default function InstitutionClient() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const [inviterEmail, setInviterEmail] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>('instructor');

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase()}/api/tenants`);
      if (!response.ok) {
        throw new Error('We could not load institution workspaces right now.');
      }
      const payload = await response.json();
      setWorkspaces(Array.isArray(payload?.data) ? payload.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async (workspace: Workspace, email: string) => {
    setError(null);
    try {
      const response = await fetch(`${apiBase()}/api/tenants/${workspace.id}/members`, {
        headers: { 'x-member-email': email },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.message || 'Unable to list members.');
      }
      const payload = await response.json();
      setMembers(payload?.data?.members ?? []);
    } catch (loadError) {
      setMembers([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to list members.');
    }
  }, []);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const provisionWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`${apiBase()}/api/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, ownerEmail }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.message || 'Provisioning failed.');
      }
      setNotice(`Workspace "${name}" provisioned. The owner is ${ownerEmail}.`);
      setName('');
      setSlug('');
      setOwnerEmail('');
      await loadWorkspaces();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Provisioning failed.');
    } finally {
      setBusy(false);
    }
  };

  const inviteMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`${apiBase()}/api/tenants/${selected.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-member-email': inviterEmail },
        body: JSON.stringify({ email: inviteeEmail, role: inviteRole }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.message || 'Invitation failed.');
      }
      setNotice(`Invitation sent to ${inviteeEmail} as ${inviteRole}.`);
      setInviteeEmail('');
      await loadMembers(selected, inviterEmail);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Invitation failed.');
    } finally {
      setBusy(false);
    }
  };

  const selectWorkspace = (workspace: Workspace) => {
    setSelected(workspace);
    setMembers([]);
    setInviterEmail('');
    setNotice(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Institution Workspace</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Provision isolated workspaces, invite members, and scope credential issuance.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30" role="alert">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {notice && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300" role="status">
            {notice}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Provisioning / onboarding */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Plus className="h-5 w-5 text-blue-600" aria-hidden="true" />
              Provision a workspace
            </h2>
            <form onSubmit={provisionWorkspace} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Institution name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  placeholder="Riverstone University"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Workspace slug</span>
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  required
                  pattern="[a-z0-9-]+"
                  placeholder="riverstone"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Owner email</span>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  required
                  placeholder="dean@riverstone.edu"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Create workspace
              </button>
            </form>
          </section>

          {/* Workspace list */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Users className="h-5 w-5 text-blue-600" aria-hidden="true" />
              Your workspaces
            </h2>
            {loading ? (
              <div className="flex min-h-[10rem] items-center justify-center" role="status" aria-live="polite">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Loading workspaces...</span>
              </div>
            ) : workspaces.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No workspaces yet. Provision your first institution workspace.
              </p>
            ) : (
              <ul className="space-y-2">
                {workspaces.map((workspace) => (
                  <li key={workspace.id}>
                    <button
                      type="button"
                      onClick={() => selectWorkspace(workspace)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                        selected?.id === workspace.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="block font-medium text-slate-900 dark:text-white">{workspace.name}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {workspace.slug} · {workspace.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Membership & invitations */}
        {selected && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <GraduationCap className="h-5 w-5 text-blue-600" aria-hidden="true" />
              {selected.name} — members &amp; invitations
            </h2>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Acting member email identifies the inviter (owner or admin) for the reference API.
            </p>

            <form onSubmit={inviteMember} className="mb-6 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Your email (inviter)</span>
                <input
                  type="email"
                  value={inviterEmail}
                  onChange={(event) => setInviterEmail(event.target.value)}
                  required
                  placeholder="dean@riverstone.edu"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Invitee email</span>
                <input
                  type="email"
                  value={inviteeEmail}
                  onChange={(event) => setInviteeEmail(event.target.value)}
                  required
                  placeholder="professor@riverstone.edu"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Role</span>
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as (typeof ROLES)[number])}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:col-span-3"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                Send invitation
              </button>
            </form>

            {members.length > 0 && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-slate-900 dark:text-white">{member.email}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
