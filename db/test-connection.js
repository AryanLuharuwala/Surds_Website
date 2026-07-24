/* Quick connectivity check: node db/test-connection.js */
const { sql } = require('./client');

(async () => {
  const v = await sql`select version(), current_database() as db, now() as ts`;
  console.log('Connected OK');
  console.log('  version:', v[0].version.split(',')[0]);
  console.log('  database:', v[0].db);
  console.log('  server time:', v[0].ts);

  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name`;
  console.log('  public tables:', tables.length ? tables.map(t => t.table_name).join(', ') : '(none yet)');
})().catch(e => { console.error('CONNECTION FAILED:', e.message); process.exit(1); });
