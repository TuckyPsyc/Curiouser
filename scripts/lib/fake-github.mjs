// A small stand-in for GitHub's API, for tests only. It keeps issues, comments,
// pull requests, failed runs and the "Videos" release in memory and records
// every request, so a test can see exactly what a script tried to do.
// Point a script at it with CURIOUSER_API=<url>.
import { createServer } from 'node:http';

export async function fakeGitHub({ owner = 'TuckyPsyc', issues = [], pulls = [], runs = [], release = null, files = {} } = {}) {
  const state = { issues: issues.map((i) => ({ comments: 0, assignees: [], labels: [], state: 'open', ...i })), comments: [], pulls, runs, release, requests: [], labels: new Set() };
  let nextNumber = Math.max(100, ...state.issues.map((i) => i.number + 1));
  let nextComment = 1;
  const send = (res, code, body) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    const q = Object.fromEntries(url.searchParams);
    state.requests.push({ method: req.method, path, query: q, body });
    const base = `${self.url}`;
    const html = (n) => `https://github.com/${owner}/curiouser/issues/${n}`;
    let m;

    if (req.method === 'GET' && (m = /^\/download\/(.+)$/.exec(path))) {
      res.writeHead(files[m[1]] === undefined ? 404 : 200, { 'content-type': 'text/plain' });
      return res.end(files[m[1]] ?? 'Not Found');
    }
    if (req.method === 'POST' && path === '/graphql') return send(res, 200, { data: { repository: { issue: { id: 'I_1', isPinned: true } } } });
    if (!(m = /^\/repos\/[^/]+\/[^/]+(\/.*)$/.exec(path))) return send(res, 404, { message: 'Not Found' });
    const p = m[1];

    if (req.method === 'POST' && p === '/labels') {
      if (state.labels.has(body.name)) return send(res, 422, { message: 'Validation Failed', errors: [{ code: 'already_exists' }] });
      state.labels.add(body.name);
      return send(res, 201, body);
    }
    if (req.method === 'GET' && p === '/issues') {
      const want = (q.labels ?? '').split(',').filter(Boolean);
      const st = q.state ?? 'open';
      return send(res, 200, state.issues.filter((i) => (st === 'all' || i.state === st) && want.every((l) => i.labels.some((x) => x.name === l))));
    }
    if (req.method === 'POST' && p === '/issues') {
      const issue = {
        number: nextNumber++,
        title: body.title,
        body: body.body,
        state: 'open',
        labels: (body.labels ?? []).map((name) => ({ name })),
        assignees: (body.assignees ?? []).map((login) => ({ login })),
        user: { login: owner, type: 'User' },
        author_association: 'OWNER',
        comments: 0,
        created_at: new Date().toISOString(),
      };
      issue.html_url = html(issue.number);
      state.issues.push(issue);
      return send(res, 201, issue);
    }
    if ((m = /^\/issues\/(\d+)$/.exec(p))) {
      const issue = state.issues.find((i) => i.number === Number(m[1]));
      if (!issue) return send(res, 404, { message: 'Not Found' });
      if (req.method === 'PATCH') Object.assign(issue, body);
      return send(res, 200, issue);
    }
    if (req.method === 'POST' && (m = /^\/issues\/(\d+)\/assignees$/.exec(p))) {
      const issue = state.issues.find((i) => i.number === Number(m[1]));
      for (const login of body.assignees) if (!issue.assignees.some((a) => a.login === login)) issue.assignees.push({ login });
      return send(res, 201, issue);
    }
    if ((m = /^\/issues\/(\d+)\/comments$/.exec(p))) {
      const n = Number(m[1]);
      if (req.method === 'GET') return send(res, 200, state.comments.filter((c) => c.issue === n));
      const c = { id: nextComment++, issue: n, body: body.body, user: { login: 'github-actions[bot]', type: 'Bot' }, author_association: 'NONE', created_at: new Date().toISOString() };
      state.comments.push(c);
      const issue = state.issues.find((i) => i.number === n);
      if (issue) issue.comments++;
      return send(res, 201, c);
    }
    if (req.method === 'DELETE' && (m = /^\/issues\/comments\/(\d+)$/.exec(p))) {
      state.comments = state.comments.filter((c) => c.id !== Number(m[1]));
      return send(res, 204);
    }
    if (req.method === 'GET' && p === '/pulls') return send(res, 200, state.pulls.filter((x) => q.state === 'all' || x.state === (q.state ?? 'open')));
    if (req.method === 'GET' && p === '/actions/runs') return send(res, 200, { workflow_runs: state.runs });
    if (req.method === 'GET' && p.startsWith('/releases/tags/')) {
      if (!state.release) return send(res, 404, { message: 'Not Found' });
      return send(res, 200, {
        ...state.release,
        assets: state.release.assets.map((a) => ({ browser_download_url: `${base}/download/${a.name}`, ...a })),
      });
    }
    return send(res, 404, { message: 'Not Found' });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const self = {
    url: `http://127.0.0.1:${server.address().port}`,
    state,
    writes: () => state.requests.filter((r) => r.method !== 'GET'),
    close: () => new Promise((r) => server.close(r)),
  };
  return self;
}
