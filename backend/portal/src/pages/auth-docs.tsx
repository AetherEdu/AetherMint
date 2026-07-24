'use client';

import { useState } from 'react';
import { Lock, Key, RefreshCw, Shield, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const SECTIONS: Section[] = [
  { id: 'overview',    title: 'Overview',           icon: <Shield className="w-4 h-4" /> },
  { id: 'jwt',         title: 'JWT Authentication', icon: <Lock className="w-4 h-4" /> },
  { id: 'apikey',      title: 'API Key Auth',        icon: <Key className="w-4 h-4" /> },
  { id: 'refresh',     title: 'Token Refresh',       icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'roles',       title: 'Roles & Permissions', icon: <Shield className="w-4 h-4" /> },
  { id: 'errors',      title: 'Auth Error Codes',    icon: <Shield className="w-4 h-4" /> },
];

// ─── Code snippets ────────────────────────────────────────────────────────────

const CODE = {
  register: `// 1. Register a new account
const response = await fetch('http://localhost:3001/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'johndoe',
    email:    'john@example.com',
    password: 'securePass123',
    role:     'student',          // 'student' | 'educator' | 'admin'
  }),
});
const { token, user } = await response.json();
// Store the token securely (e.g. httpOnly cookie or memory)
localStorage.setItem('token', token);`,

  login: `// 2. Log in and receive JWT
const response = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'johndoe', password: 'securePass123' }),
});
const { token } = await response.json();
// token is valid for 24 hours`,

  useToken: `// 3. Attach JWT to every protected request
const token = localStorage.getItem('token');

const response = await fetch('http://localhost:3001/api/enrollments', {
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type':  'application/json',
  },
});`,

  apiKey: `// Server-to-server: use an API key instead of JWT
const response = await fetch('http://localhost:3001/api/analytics/dashboard', {
  headers: {
    'X-API-Key':     'YOUR_API_KEY_HERE',
    'Content-Type':  'application/json',
  },
});`,

  pythonLogin: `import requests

# Login
resp = requests.post('http://localhost:3001/api/auth/login', json={
    'username': 'johndoe',
    'password': 'securePass123',
})
token = resp.json()['token']

# Use JWT
protected = requests.get(
    'http://localhost:3001/api/enrollments',
    headers={'Authorization': f'Bearer {token}'},
)
print(protected.json())`,
};

// ─── Helper components ────────────────────────────────────────────────────────

function CodeBlock({ code, language = 'javascript' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg bg-gray-950 border border-gray-800 overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-xs text-gray-500 font-mono">{language}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono text-gray-200 overflow-x-auto whitespace-pre leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-900/40 text-green-300 border-green-800',
    yellow: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
    red:    'bg-red-900/40 text-red-300 border-red-800',
    blue:   'bg-blue-900/40 text-blue-300 border-blue-800',
    gray:   'bg-gray-800 text-gray-300 border-gray-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono border ${colors[color] ?? colors.gray}`}>
      {children}
    </span>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors text-sm font-medium text-gray-200"
      >
        {title}
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-4 bg-gray-950 text-sm text-gray-300 space-y-2">{children}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthDocsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-950/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-indigo-400" />
          <span className="text-lg font-semibold text-white">Authentication Docs</span>
        </div>
        <a href="/" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          ← API Playground
        </a>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-56 border-r border-gray-800 p-4 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Contents</p>
          <ul className="space-y-1">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <button
                  onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                    activeSection === s.id
                      ? 'bg-indigo-900/40 text-indigo-300'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {s.icon}
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <main className="flex-1 max-w-3xl mx-auto px-8 py-10 space-y-16">

          {/* Overview */}
          <section id="overview" className="scroll-mt-20">
            <h1 className="text-3xl font-bold text-white mb-2">Authentication</h1>
            <p className="text-gray-400 mb-6">
              AetherMint supports two authentication methods. Most client-facing endpoints use{' '}
              <Badge color="blue">JWT Bearer tokens</Badge>, while server-to-server integrations
              can use an <Badge color="green">X-API-Key</Badge> header.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2 text-indigo-300 font-semibold">
                  <Lock className="w-4 h-4" /> JWT (Bearer)
                </div>
                <p className="text-sm text-gray-400">
                  Obtained by logging in. Passed as an{' '}
                  <code className="text-indigo-300 text-xs">Authorization: Bearer &lt;token&gt;</code>{' '}
                  header. Valid for 24 hours.
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2 text-green-300 font-semibold">
                  <Key className="w-4 h-4" /> API Key
                </div>
                <p className="text-sm text-gray-400">
                  Static key for server-to-server use. Passed as an{' '}
                  <code className="text-indigo-300 text-xs">X-API-Key: &lt;key&gt;</code> header.
                  No expiry; rotate manually.
                </p>
              </div>
            </div>
          </section>

          {/* JWT */}
          <section id="jwt" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-400" /> JWT Authentication
            </h2>
            <p className="text-gray-400 mb-4">
              The standard flow: register or log in to receive a signed JWT, then send it with
              every protected request in the <code className="text-xs text-indigo-300">Authorization</code> header.
            </p>

            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">1. Register</h3>
            <CodeBlock code={CODE.register} language="javascript" />

            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">2. Login</h3>
            <CodeBlock code={CODE.login} language="javascript" />

            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">3. Use the token</h3>
            <CodeBlock code={CODE.useToken} language="javascript" />

            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Python example</h3>
            <CodeBlock code={CODE.pythonLogin} language="python" />

            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 text-sm text-yellow-200">
              <strong>Security tip:</strong> Do not store JWTs in <code className="text-xs">localStorage</code> in
              production. Prefer an httpOnly cookie or in-memory store to prevent XSS theft.
            </div>
          </section>

          {/* API Key */}
          <section id="apikey" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <Key className="w-5 h-5 text-green-400" /> API Key Authentication
            </h2>
            <p className="text-gray-400 mb-4">
              For backend integrations that need long-lived credentials without user sessions.
              API keys are static and do not expire unless manually rotated.
            </p>

            <CodeBlock code={CODE.apiKey} language="javascript" />

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-left">
                    <th className="py-2 pr-4">Header</th>
                    <th className="py-2 pr-4">Value</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-900">
                    <td className="py-2 pr-4 font-mono text-xs text-indigo-300">X-API-Key</td>
                    <td className="py-2 pr-4 font-mono text-xs">YOUR_API_KEY_HERE</td>
                    <td className="py-2 text-gray-400 text-xs">Obtained from the admin dashboard</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Token Refresh */}
          <section id="refresh" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-400" /> Token Refresh
            </h2>
            <p className="text-gray-400 mb-4">
              JWTs are valid for <strong>24 hours</strong>. When a token expires the API returns a{' '}
              <Badge color="red">401 TOKEN_EXPIRED</Badge>. Re-authenticate via{' '}
              <code className="text-xs text-indigo-300">POST /api/auth/login</code> to obtain a
              new token.
            </p>

            <Collapsible title="Token expiry handling example (JavaScript)">
              <CodeBlock code={`async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const resp = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: \`Bearer \${token}\` },
  });

  if (resp.status === 401) {
    // Token expired — redirect to login
    window.location.href = '/login';
    return;
  }
  return resp.json();
}`} language="javascript" />
            </Collapsible>
          </section>

          {/* Roles */}
          <section id="roles" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-400" /> Roles &amp; Permissions
            </h2>
            <p className="text-gray-400 mb-4">
              AetherMint uses role-based access control (RBAC). Every user has one of three roles.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-left">
                    <th className="py-2 pr-6">Role</th>
                    <th className="py-2 pr-6">Capabilities</th>
                    <th className="py-2">Restricted from</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300 text-xs">
                  {[
                    { role: 'student', color: 'blue', can: 'Enroll in courses, submit quizzes, view own credentials & profile', cannot: 'Create courses, issue credentials, access admin endpoints' },
                    { role: 'educator', color: 'green', can: 'All student permissions + create courses, issue credentials, view analytics for own courses', cannot: 'Platform-wide admin operations' },
                    { role: 'admin', color: 'red', can: 'Full platform access: manage users, roles, platform analytics, and all resources', cannot: '—' },
                  ].map(r => (
                    <tr key={r.role} className="border-b border-gray-900">
                      <td className="py-3 pr-6"><Badge color={r.color}>{r.role}</Badge></td>
                      <td className="py-3 pr-6 text-gray-400">{r.can}</td>
                      <td className="py-3 text-gray-500">{r.cannot}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Roles are assigned at registration and can be changed by admins via{' '}
              <code className="text-indigo-300">PUT /api/auth/assign-role/:userId</code>.
            </p>
          </section>

          {/* Error codes */}
          <section id="errors" className="scroll-mt-20">
            <h2 className="text-2xl font-bold text-white mb-1">Auth Error Codes</h2>
            <p className="text-gray-400 mb-4">
              All authentication errors return a structured JSON body with a machine-readable <code className="text-xs text-indigo-300">error.code</code>.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-left">
                    <th className="py-2 pr-4">HTTP</th>
                    <th className="py-2 pr-4">Error Code</th>
                    <th className="py-2">Meaning</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300 text-xs font-mono">
                  {[
                    { status: '400', code: 'MISSING_CREDENTIALS', meaning: 'username or password missing from request body' },
                    { status: '400', code: 'INVALID_ROLE',        meaning: 'role is not student | educator | admin' },
                    { status: '401', code: 'INVALID_CREDENTIALS', meaning: 'username/password combination is incorrect' },
                    { status: '401', code: 'NO_TOKEN',            meaning: 'Authorization header missing' },
                    { status: '401', code: 'TOKEN_EXPIRED',       meaning: 'JWT has passed its 24-hour expiry' },
                    { status: '401', code: 'INVALID_TOKEN',       meaning: 'JWT signature verification failed' },
                    { status: '403', code: 'FORBIDDEN',           meaning: 'Authenticated but role lacks the required permission' },
                    { status: '409', code: 'USER_EXISTS',         meaning: 'Username or email already registered' },
                  ].map(e => (
                    <tr key={e.code} className="border-b border-gray-900">
                      <td className="py-2 pr-4">
                        <Badge color={e.status.startsWith('4') ? (e.status === '403' ? 'yellow' : 'red') : 'green'}>
                          {e.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-indigo-300">{e.code}</td>
                      <td className="py-2 text-gray-400 font-sans">{e.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Example error response</p>
              <pre className="text-xs font-mono text-gray-300 whitespace-pre leading-relaxed">{`{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your session has expired. Please log in again.",
    "requestId": "req-abc-12345"
  }
}`}</pre>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
