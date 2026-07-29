'use client';

import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { Play, Copy, Check, Code2, Lock, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description: string;
  auth: boolean;
  defaultBody?: string;
  tags: string[];
}

interface EndpointGroup {
  name: string;
  endpoints: APIEndpoint[];
}

// ─── Endpoint catalogue ───────────────────────────────────────────────────────

const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    name: 'System',
    endpoints: [
      { path: '/api/health', method: 'GET', description: 'Service health check', auth: false, tags: ['System'] },
    ],
  },
  {
    name: 'Authentication',
    endpoints: [
      {
        path: '/api/auth/register', method: 'POST', description: 'Register a new user', auth: false,
        defaultBody: JSON.stringify({ username: 'johndoe', email: 'john@example.com', password: 'securePass123', role: 'student' }, null, 2),
        tags: ['Authentication'],
      },
      {
        path: '/api/auth/login', method: 'POST', description: 'Authenticate and get JWT', auth: false,
        defaultBody: JSON.stringify({ username: 'johndoe', password: 'securePass123' }, null, 2),
        tags: ['Authentication'],
      },
      { path: '/api/auth/profile', method: 'GET', description: 'Get current user profile', auth: true, tags: ['Authentication'] },
    ],
  },
  {
    name: 'Credentials',
    endpoints: [
      {
        path: '/api/credentials/issue', method: 'POST', description: 'Issue a credential on-chain', auth: true,
        defaultBody: JSON.stringify({ recipientAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA', courseId: 'course_01HXZ9QABC123456' }, null, 2),
        tags: ['Credentials'],
      },
      { path: '/api/credentials/cred_01HXZ9QABC111001', method: 'GET', description: 'Verify a credential by ID', auth: false, tags: ['Credentials'] },
      { path: '/api/credentials/user/GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA', method: 'GET', description: 'Get credentials for a user address', auth: false, tags: ['Credentials'] },
    ],
  },
  {
    name: 'Courses',
    endpoints: [
      {
        path: '/api/courses/search', method: 'POST', description: 'Search courses', auth: false,
        defaultBody: JSON.stringify({ query: 'blockchain', sessionId: 'sess_abc123', filters: { category: 'programming', level: 'beginner' } }, null, 2),
        tags: ['Courses'],
      },
      { path: '/api/courses/trending', method: 'GET', description: 'Get trending courses', auth: false, tags: ['Courses'] },
      { path: '/api/courses/suggestions?q=block', method: 'GET', description: 'Autocomplete suggestions', auth: false, tags: ['Courses'] },
    ],
  },
  {
    name: 'Enrollments',
    endpoints: [
      { path: '/api/enrollments', method: 'GET', description: 'List current user enrollments', auth: true, tags: ['Enrollments'] },
      {
        path: '/api/enrollments', method: 'POST', description: 'Enroll in a course', auth: true,
        defaultBody: JSON.stringify({ courseId: 'course_01HXZ9QABC123456', paymentMethod: 'stellar' }, null, 2),
        tags: ['Enrollments'],
      },
      { path: '/api/enrollments/enr_01HXZ9QABC999001/progress', method: 'GET', description: 'Get enrollment progress', auth: true, tags: ['Enrollments'] },
    ],
  },
  {
    name: 'Payments',
    endpoints: [
      {
        path: '/api/payments/intent', method: 'POST', description: 'Create a payment intent', auth: true,
        defaultBody: JSON.stringify({ enrollmentId: 'enr_01HXZ9QABC999001', method: 'stellar', amount: 49.99, currency: 'USD' }, null, 2),
        tags: ['Payments'],
      },
      { path: '/api/payments/history', method: 'GET', description: 'Get payment history', auth: true, tags: ['Payments'] },
      { path: '/api/payments/stellar/balance/GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA', method: 'GET', description: 'Get Stellar account balance', auth: true, tags: ['Payments'] },
    ],
  },
  {
    name: 'Content (IPFS)',
    endpoints: [
      { path: '/api/content/health', method: 'GET', description: 'IPFS service health', auth: false, tags: ['Content'] },
      { path: '/api/content/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', method: 'GET', description: 'Retrieve IPFS content by CID', auth: false, tags: ['Content'] },
      { path: '/api/content/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/metadata', method: 'GET', description: 'Get content metadata', auth: false, tags: ['Content'] },
    ],
  },
  {
    name: 'Holographic',
    endpoints: [
      {
        path: '/api/holographic/encode', method: 'POST', description: 'Encode content holographically', auth: true,
        defaultBody: JSON.stringify({ contentId: 'course-101', data: 'SGVsbG8gV29ybGQ=', compressionLevel: 5 }, null, 2),
        tags: ['Holographic'],
      },
      { path: '/api/holographic/decode/holo_a1b2c3d4e5f6', method: 'GET', description: 'Decode holographic content', auth: true, tags: ['Holographic'] },
      { path: '/api/holographic/metrics', method: 'GET', description: 'Get storage metrics', auth: true, tags: ['Holographic'] },
      {
        path: '/api/holographic/access/parallel', method: 'POST', description: 'Parallel content access', auth: true,
        defaultBody: JSON.stringify({ hashes: ['holo_a1b2c3', 'holo_d4e5f6'] }, null, 2),
        tags: ['Holographic'],
      },
    ],
  },
  {
    name: 'Quizzes',
    endpoints: [
      { path: '/api/quizzes', method: 'GET', description: 'List quizzes', auth: true, tags: ['Quizzes'] },
      {
        path: '/api/quizzes', method: 'POST', description: 'Create a quiz', auth: true,
        defaultBody: JSON.stringify({ title: 'Blockchain Basics', courseId: 'course_01HXZ9QABC123456', questions: [{ text: 'What is a hash?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' }], timeLimit: 30 }, null, 2),
        tags: ['Quizzes'],
      },
      {
        path: '/api/quizzes/quiz_01HXZ9QABC666001/submit', method: 'POST', description: 'Submit quiz answers', auth: true,
        defaultBody: JSON.stringify({ answers: ['A', 'C', 'B'], timeTaken: 840 }, null, 2),
        tags: ['Quizzes'],
      },
    ],
  },
  {
    name: 'Notifications',
    endpoints: [
      { path: '/api/notifications', method: 'GET', description: 'Get user notifications', auth: true, tags: ['Notifications'] },
      { path: '/api/notifications/read-all', method: 'PATCH', description: 'Mark all notifications read', auth: true, tags: ['Notifications'] },
    ],
  },
  {
    name: 'Gamification',
    endpoints: [
      { path: '/api/gamification/leaderboard', method: 'GET', description: 'Global leaderboard', auth: false, tags: ['Gamification'] },
      { path: '/api/gamification/user/usr_01HXZ9QABC123456/achievements', method: 'GET', description: 'User achievements', auth: true, tags: ['Gamification'] },
      {
        path: '/api/gamification/event', method: 'POST', description: 'Process gamification event', auth: true,
        defaultBody: JSON.stringify({ userId: 'usr_01HXZ9QABC123456', event: 'lesson_complete', data: { courseId: 'course_01HXZ9QABC123456' } }, null, 2),
        tags: ['Gamification'],
      },
    ],
  },
  {
    name: 'Analytics',
    endpoints: [
      {
        path: '/api/analytics/event', method: 'POST', description: 'Track an analytics event', auth: true,
        defaultBody: JSON.stringify({ eventType: 'lesson_complete', userId: 'usr_01HXZ9QABC123456', courseId: 'course_01HXZ9QABC123456' }, null, 2),
        tags: ['Analytics'],
      },
      { path: '/api/analytics/dashboard', method: 'GET', description: 'Platform analytics dashboard', auth: true, tags: ['Analytics'] },
    ],
  },
  {
    name: 'Collaboration',
    endpoints: [
      { path: '/api/collaboration/rooms', method: 'GET', description: 'List collaboration rooms', auth: true, tags: ['Collaboration'] },
      {
        path: '/api/collaboration/rooms', method: 'POST', description: 'Create a collaboration room', auth: true,
        defaultBody: JSON.stringify({ courseId: 'course_01HXZ9QABC123456', maxParticipants: 5 }, null, 2),
        tags: ['Collaboration'],
      },
      { path: '/api/collaboration/rooms/room_01HXZ9QABC333001/join', method: 'POST', description: 'Join a room', auth: true, tags: ['Collaboration'] },
    ],
  },
  {
    name: 'Transactions',
    endpoints: [
      { path: '/api/transactions', method: 'GET', description: 'List queued transactions', auth: true, tags: ['Transactions'] },
      {
        path: '/api/transactions', method: 'POST', description: 'Queue a Stellar transaction', auth: true,
        defaultBody: JSON.stringify({ sourceAccount: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA', destinationAccount: 'GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP', amount: '10.5', priority: 'medium' }, null, 2),
        tags: ['Transactions'],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  POST:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PUT:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  PATCH:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function buildCodeSnippet(lang: string, method: string, fullUrl: string, headers: string, body: string): string {
  const headersObj = (() => { try { return JSON.parse(headers); } catch { return {}; } })();
  const headerLines = Object.entries(headersObj).map(([k, v]) => `  "${k}": "${v}"`).join(',\n');

  if (lang === 'curl') {
    const hFlags = Object.entries(headersObj).map(([k, v]) => `-H "${k}: ${v}"`).join(' ');
    const bodyFlag = method !== 'GET' ? `-d '${body}'` : '';
    return `curl -X ${method} "${fullUrl}" \\\n  ${hFlags} \\\n  ${bodyFlag}`.trim();
  }

  if (lang === 'python') {
    return `import requests\n\nurl = "${fullUrl}"\nheaders = {\n${headerLines}\n}\n${method !== 'GET' ? `payload = ${body}\n\nresponse = requests.${method.toLowerCase()}(url, headers=headers, json=payload)` : `response = requests.get(url, headers=headers)`}\nprint(response.json())`;
  }

  // javascript
  const bodyPart = method !== 'GET' ? `\n  body: JSON.stringify(${body}),` : '';
  return `const response = await fetch("${fullUrl}", {\n  method: "${method}",\n  headers: {\n${headerLines}\n  },${bodyPart}\n});\nconst data = await response.json();\nconsole.log(data);`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function APIPlayground() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [body, setBody] = useState('{}');
  const [response, setResponse] = useState<{ status?: number; data: unknown } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeLang, setCodeLang] = useState('javascript');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Authentication: true });

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

  const selectEndpoint = useCallback((ep: APIEndpoint) => {
    setSelectedEndpoint(ep);
    setMethod(ep.method);
    setUrl(ep.path);
    setBody(ep.defaultBody ?? '{}');
    setResponse(null);
  }, []);

  const toggleGroup = (name: string) =>
    setOpenGroups(prev => ({ ...prev, [name]: !prev[name] }));

  const executeRequest = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const config: any = { method: method.toLowerCase(), url: `${API_BASE}${url}`, headers };
      if (method !== 'GET' && body !== '{}') {
        try { config.data = JSON.parse(body); } catch { config.data = body; }
      }

      const res = await axios(config);
      setResponse({ status: res.status, data: res.data });
    } catch (err: any) {
      setResponse({
        status: err.response?.status,
        data: err.response?.data ?? { error: err.message },
      });
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) currentHeaders['Authorization'] = `Bearer ${authToken}`;
  const snippet = buildCodeSnippet(codeLang, method, `${API_BASE}${url}`, JSON.stringify(currentHeaders, null, 2), body);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Code2 className="w-6 h-6 text-indigo-400" />
          <span className="text-lg font-semibold text-white">AetherMint API Playground</span>
        </div>
        <a
          href="/auth-docs"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Authentication Docs →
        </a>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        {/* ── Sidebar: endpoint list ── */}
        <aside className="w-72 border-r border-gray-800 overflow-y-auto flex-shrink-0">
          {ENDPOINT_GROUPS.map(group => (
            <div key={group.name}>
              <button
                onClick={() => toggleGroup(group.name)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                {group.name}
                {openGroups[group.name]
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />}
              </button>

              {openGroups[group.name] && (
                <ul>
                  {group.endpoints.map((ep, i) => (
                    <li key={i}>
                      <button
                        onClick={() => selectEndpoint(ep)}
                        className={`w-full text-left px-4 py-2 flex items-start gap-2 transition-colors text-xs ${
                          selectedEndpoint?.path === ep.path && selectedEndpoint?.method === ep.method
                            ? 'bg-indigo-900/40 border-l-2 border-indigo-500'
                            : 'hover:bg-gray-800/60 border-l-2 border-transparent'
                        }`}
                      >
                        <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${METHOD_COLORS[ep.method]}`}>
                          {ep.method}
                        </span>
                        <span className="break-all text-gray-300 leading-snug">
                          {ep.path}
                          {ep.auth && <Lock className="inline ml-1 w-2.5 h-2.5 text-yellow-500" />}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>

        {/* ── Main: request + response ── */}
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Endpoint description */}
          {selectedEndpoint && (
            <div className="bg-gray-800/50 rounded-lg px-4 py-3 text-sm text-gray-300">
              <span className={`inline-block px-2 py-0.5 rounded mr-2 text-xs font-bold ${METHOD_COLORS[selectedEndpoint.method]}`}>
                {selectedEndpoint.method}
              </span>
              <code className="text-indigo-300">{selectedEndpoint.path}</code>
              {' — '}
              {selectedEndpoint.description}
              {selectedEndpoint.auth && (
                <span className="ml-2 text-yellow-400 text-xs">
                  <Lock className="inline w-3 h-3 mr-0.5" />Requires JWT
                </span>
              )}
            </div>
          )}

          {/* Request bar */}
          <div className="bg-gray-900 rounded-lg p-4 space-y-3 border border-gray-800">
            <div className="flex gap-2">
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {['GET','POST','PUT','PATCH','DELETE'].map(m => (
                  <option key={m}>{m}</option>
                ))}
              </select>

              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="/api/endpoint"
                className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />

              <button
                onClick={executeRequest}
                disabled={loading || !url}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-sm flex items-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4" />
                {loading ? 'Sending…' : 'Send'}
              </button>
            </div>

            {/* Auth token */}
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-yellow-500 shrink-0" />
              <input
                type="password"
                value={authToken}
                onChange={e => setAuthToken(e.target.value)}
                placeholder="Bearer token (paste JWT here)"
                className="flex-1 px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-500 font-mono"
              />
            </div>
          </div>

          {/* Request body */}
          {method !== 'GET' && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-400">
                Request Body (JSON)
              </div>
              <Editor
                height="180px"
                language="json"
                value={body}
                onChange={v => setBody(v ?? '{}')}
                theme="vs-dark"
                options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', scrollBeyondLastLine: false }}
              />
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Response
                  {response.status && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                      response.status < 300 ? 'bg-green-900/60 text-green-300' :
                      response.status < 400 ? 'bg-yellow-900/60 text-yellow-300' :
                      'bg-red-900/60 text-red-300'
                    }`}>
                      {response.status}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => copyText(JSON.stringify(response.data, null, 2))}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <Editor
                height="220px"
                language="json"
                value={JSON.stringify(response.data, null, 2)}
                theme="vs-dark"
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', scrollBeyondLastLine: false }}
              />
            </div>
          )}

          {/* Code snippet */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
              <div className="flex gap-2">
                {(['javascript', 'python', 'curl'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setCodeLang(lang)}
                    className={`px-3 py-1 rounded text-xs transition-colors ${codeLang === lang ? 'bg-indigo-700 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <button
                onClick={() => copyText(snippet)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <Editor
              height="160px"
              language={codeLang === 'curl' ? 'shell' : codeLang}
              value={snippet}
              theme="vs-dark"
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', scrollBeyondLastLine: false }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
