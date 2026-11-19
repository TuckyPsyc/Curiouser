// One way for the scripts to talk to GitHub's API.
//
// - CURIOUSER_API: the address of a stand-in GitHub, used only by the tests.
// - GITHUB_TOKEN: the workflow's own token, as the desk and release workflows have it.
// - Otherwise the gh command, which is how the agents are signed in.
import { spawnSync } from 'node:child_process';

// Does this run hold a GitHub token of its own? A workflow does. An agent's
// session may set GITHUB_TOKEN to a placeholder ("proxy-injected") that only the
// gh command and git can use, because their requests pass through a proxy that
// swaps in the real sign-in; a request made straight from Node with it is refused
// as "Bad credentials". So a placeholder counts as no token, and the scripts the
// agents run fall back to gh: github({ useGh: !hasOwnToken() }).
export const hasOwnToken = () => Boolean(process.env.GITHUB_TOKEN) && !/^proxy-/.test(process.env.GITHUB_TOKEN);

export function github({ useGh = false } = {}) {
  const base = process.env.CURIOUSER_API || 'https://api.github.com';
  const viaGh = useGh && !process.env.CURIOUSER_API;
  return async function api(method, path, body) {
    if (viaGh) {
      const r = spawnSync('gh', ['api', '-X', method, path, ...(body ? ['--input', '-'] : [])], {
        input: body ? JSON.stringify(body) : undefined,
        encoding: 'utf8',
      });
      if (r.status !== 0) throw new Error(`${method} ${path}: ${r.stdout || r.stderr}`);
      return r.stdout ? JSON.parse(r.stdout) : null;
    }
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'curiouser-scripts',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
}

// Who may put something on Carl's queue. Anyone can open an issue on a public
// repository, so the queue only trusts the owner, collaborators and bots.
export const trusted = (item) =>
  ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(item?.author_association) || item?.user?.type === 'Bot';
