// One way for the scripts to talk to GitHub's API.
//
// - CURIOUSER_API: the address of a stand-in GitHub, used only by the tests.
// - GITHUB_TOKEN: the workflow's own token, as the desk and release workflows have it.
// - Otherwise the gh command, which is how the agents are signed in.
import { spawnSync } from 'node:child_process';

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
