#!/usr/bin/env node
// Runs the pgTAP files in supabase/tests/database against the linked hosted project,
// without Docker (`supabase test db` needs Docker for pg_prove).
//
// How: each top-level assertion's output is recorded in a scratch table, and the run ends
// by raising an error that carries the report. The error rolls back everything the tests
// did, so nothing is left in the database whatever the CLI does with transactions.
// The CLI truncates long error messages, so the report holds counts plus failures only,
// and the count is checked against the number of assertions in the file.
//
//   npm run test:db              all test files
//   npm run test:db -- access    only files whose name contains "access"
//   npm run test:db -- --with supabase/migrations/<new>.sql
//                                apply a migration first (inside the same rolled-back run),
//                                to test it before `supabase db push`

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_DIR = 'supabase/tests/database';
const ASSERTION = /^select (ok|is|isnt|matches|is_empty|isnt_empty|lives_ok|throws_ok)\(/gm;
const MARKER = 'TAP_REPORT';

const args = process.argv.slice(2);
const withAt = args.indexOf('--with');
const pending = withAt >= 0 ? readFileSync(args.splice(withAt, 2)[1], 'utf8') : '';
const filter = args[0] ?? '';
const files = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith('.test.sql') && f.includes(filter))
  .sort();
if (files.length === 0) {
  console.error(`No test files in ${TEST_DIR} match "${filter}".`);
  process.exit(1);
}

const prelude = `
create schema tap_out;
grant usage on schema tap_out to authenticated, anon;
create table tap_out.lines (id int generated always as identity, line text);
grant insert on tap_out.lines to authenticated, anon;
`;

const report = `
do $report$
declare
  v_total int;
  v_failed int;
  v_failures text;
begin
  select count(*), count(*) filter (where l.line like 'not ok%'),
         string_agg(l.line, E'\\n' order by l.id) filter (where l.line like 'not ok%')
    into v_total, v_failed, v_failures
  from tap_out.lines l;
  raise exception '${MARKER} total=% failed=% %', v_total, v_failed, coalesce(E'\\n' || v_failures, '');
end
$report$;
`;

function wrap(sql) {
  const ending = /select \* from finish\(\);\s*rollback;\s*$/;
  if (!ending.test(sql)) throw new Error('Test file must end with "select * from finish();" and "rollback;"');
  const body = sql.replace(ending, '').replace(ASSERTION, 'insert into tap_out.lines (line) select $1(');
  return body.replace(/^begin;\s*$/m, () => `begin;\n${prelude}\n${pending}`) + report;
}

let failed = 0;
const dir = mkdtempSync(join(tmpdir(), 'gtrack-tap-'));
try {
  for (const file of files) {
    const runFile = join(dir, file);
    const source = readFileSync(join(TEST_DIR, file), 'utf8');
    const expected = source.match(ASSERTION)?.length ?? 0;
    writeFileSync(runFile, wrap(source));

    let output = '';
    try {
      output = execFileSync('supabase', ['db', 'query', '--remote', '--yes', '-f', runFile], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    }

    // The CLI prints the database error as escaped JSON; unescape until the report is readable.
    let text = output;
    for (let i = 0; i < 3 && text.includes('\\n'); i++) text = text.replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
    const start = text.indexOf(MARKER);
    console.log(`\n# ${file}`);
    if (start === -1) {
      console.log('not ok - the run stopped before the report (an unexpected error):\n' + output);
      failed++;
      continue;
    }
    const body = text
      .slice(start + MARKER.length)
      .split('\nQUERY:')[0]
      .split('\nCONTEXT:')[0]
      .replace(/\\"/g, '"')
      .trim();
    const summary = body.match(/^total=(\d+) failed=(\d+)/);
    if (!summary) {
      console.log('not ok - could not read the report:\n' + body);
      failed++;
      continue;
    }
    const [total, fileFailed] = [Number(summary[1]), Number(summary[2])];
    const failures = body.slice(summary[0].length).trim();
    if (failures) console.log(failures);
    if (total !== expected) {
      console.log(`not ok - ${total} assertions ran but the file has ${expected}`);
      failed++;
    }
    console.log(`${total - fileFailed} of ${expected} passed`);
    failed += fileFailed;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
