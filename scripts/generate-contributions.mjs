#!/usr/bin/env node
/**
 * Fetches the GitHub contribution calendar and writes:
 *   - contributions.svg  (the heatmap, styled to match the site palette)
 *   - index.html         (count + cache-busted <img>, between the contrib markers)
 *
 * Run by .github/workflows/contributions.yml on a daily cron.
 * Needs a token with read:user in GH_CONTRIB_TOKEN.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOGIN = process.env.GH_LOGIN || 'Mopra';

const CELL = 11;
const GAP = 3;
const PITCH = CELL + GAP;
const TOP = 16; // room for the month labels

// Empty day, then the four levels ramping to the site's accent.
const COLORS = ['#1a1a1a', '#0f5145', '#128a70', '#00b596', '#00d4aa'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const QUERY = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              weekday
              contributionCount
            }
          }
        }
      }
    }
  }
`;

async function fetchCalendar(login, token) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': `${login}-contributions`,
    },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status} ${res.statusText}: ${await res.text()}`);
  }

  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(`GraphQL errors: ${body.errors.map((e) => e.message).join('; ')}`);
  }

  const calendar = body.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) throw new Error(`No contribution calendar in response for "${login}"`);
  return calendar;
}

/** Quartile thresholds over the non-empty days, so the ramp uses all four levels. */
function levelFor(count, thresholds) {
  if (count <= 0) return 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (count <= thresholds[i]) return i + 1;
  }
  return 4;
}

function thresholdsFor(days) {
  const counts = days.map((d) => d.contributionCount).filter((c) => c > 0).sort((a, b) => a - b);
  if (counts.length === 0) return [1, 2, 3];
  const at = (q) => counts[Math.min(counts.length - 1, Math.floor(counts.length * q))];
  // Force strictly increasing thresholds so a low-variance year still uses all four levels.
  let floor = 0;
  return [at(0.25), at(0.5), at(0.75)].map((v) => (floor = Math.max(v, floor + 1)));
}

export function buildSvg(calendar, login = LOGIN) {
  const weeks = calendar.weeks;
  const days = weeks.flatMap((w) => w.contributionDays);
  const thresholds = thresholdsFor(days);

  const width = weeks.length * PITCH - GAP;
  const height = TOP + 7 * PITCH - GAP;

  const cells = [];
  const labels = [];
  let lastLabelWeek = -Infinity;
  let prevMonth = null;

  weeks.forEach((week, weekIndex) => {
    const x = weekIndex * PITCH;

    const firstDay = week.contributionDays[0];
    if (firstDay) {
      const month = Number(firstDay.date.slice(5, 7)) - 1;
      const startsMonth = month !== prevMonth;
      prevMonth = month;
      // Label the column where a month starts, skipping ones that would collide
      // with the previous label or overflow the right edge.
      const hasRoom = weekIndex - lastLabelWeek >= 3 && weekIndex <= weeks.length - 3;
      if (startsMonth && hasRoom) {
        labels.push(`<text x="${x}" y="10">${MONTHS[month]}</text>`);
        lastLabelWeek = weekIndex;
      }
    }

    for (const day of week.contributionDays) {
      const y = TOP + day.weekday * PITCH;
      const level = levelFor(day.contributionCount, thresholds);
      cells.push(
        `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${COLORS[level]}"><title>${day.date}: ${day.contributionCount}</title></rect>`
      );
    }
  });

  const total = calendar.totalContributions;
  const noun = total === 1 ? 'contribution' : 'contributions';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${total} ${noun} by ${login} in the last year">
  <title>${total} ${noun} by ${login} in the last year</title>
  <g font-family="ui-monospace, 'SF Mono', 'Fira Code', Consolas, monospace" font-size="13" fill="#6b6b6b">
    ${labels.join('\n    ')}
  </g>
  <g>
    ${cells.join('\n    ')}
  </g>
</svg>
`;
}

export function renderBlock(calendar, { width, height, stamp }) {
  const total = calendar.totalContributions;
  const noun = total === 1 ? 'contribution' : 'contributions';
  const count = total.toLocaleString('en-US');
  return [
    `            <img class="contrib-img" src="contributions.svg?v=${stamp}" width="${width}" height="${height}" alt="GitHub contribution graph: ${count} ${noun} in the last year">`,
    `            <span class="contrib-count">${count} ${noun} in the last year</span>`,
  ].join('\n');
}

export function injectBlock(html, block) {
  const start = '<!-- contrib:start -->';
  const end = '<!-- contrib:end -->';
  const pattern = new RegExp(`(${start})[\\s\\S]*?(${end})`);
  if (!pattern.test(html)) {
    throw new Error(`index.html is missing the ${start} / ${end} markers`);
  }
  return html.replace(pattern, `$1\n${block}\n            $2`);
}

async function main() {
  const token = process.env.GH_CONTRIB_TOKEN;
  if (!token) {
    throw new Error('GH_CONTRIB_TOKEN is not set (needs a token with the read:user scope)');
  }

  const calendar = await fetchCalendar(LOGIN, token);
  const svg = buildSvg(calendar, LOGIN);

  const width = calendar.weeks.length * PITCH - GAP;
  const height = TOP + 7 * PITCH - GAP;
  const stamp = calendar.weeks.at(-1)?.contributionDays.at(-1)?.date ?? 'latest';

  const indexPath = join(ROOT, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  const updated = injectBlock(html, renderBlock(calendar, { width, height, stamp }));

  await writeFile(join(ROOT, 'contributions.svg'), svg, 'utf8');
  await writeFile(indexPath, updated, 'utf8');

  console.log(`Wrote contributions.svg (${calendar.totalContributions} contributions, ${calendar.weeks.length} weeks)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
