import fs from 'fs/promises';
import pg from 'pg';

const { Client } = pg;
const cn = process.env.DATABASE_URL;
if (!cn) throw new Error('Set DATABASE_URL');

const client = new Client({ connectionString: cn });
await client.connect();

// tabelle e colonne
const { rows: cols } = await client.query(`
  SELECT
    c.table_schema, c.table_name, c.ordinal_position, c.column_name,
    c.udt_name AS data_type, c.is_nullable, c.column_default,
    pd.description AS column_comment
  FROM information_schema.columns c
  LEFT JOIN pg_class pc ON pc.relname = c.table_name
  LEFT JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = c.table_schema
  LEFT JOIN pg_description pd ON pd.objoid = pc.oid AND pd.objsubid = c.ordinal_position
  WHERE c.table_schema NOT IN ('pg_catalog','information_schema')
  ORDER BY c.table_schema, c.table_name, c.ordinal_position;
`);

// PK
const { rows: pks } = await client.query(`
  SELECT n.nspname AS schema, t.relname AS table, c.conname AS pk_name,
         array_agg(a.attname ORDER BY a.attnum) AS cols
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid=t.oid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  JOIN unnest(c.conkey) AS k(attnum) ON TRUE
  JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum
  WHERE c.contype='p' AND n.nspname NOT IN ('pg_catalog','information_schema')
  GROUP BY n.nspname, t.relname, c.conname
  ORDER BY 1,2;
`);

// FK
const { rows: fks } = await client.query(`
  SELECT
    sn.nspname AS src_schema, st.relname AS src_table, c.conname AS fk_name,
    array_agg(sa.attname ORDER BY sa.attnum) AS src_cols,
    tn.nspname AS tgt_schema, tt.relname AS tgt_table,
    array_agg(ta.attname ORDER BY ta.attnum) AS tgt_cols
  FROM pg_constraint c
  JOIN pg_class st ON c.conrelid = st.oid
  JOIN pg_namespace sn ON sn.oid = st.relnamespace
  JOIN pg_class tt ON c.confrelid = tt.oid
  JOIN pg_namespace tn ON tn.oid = tt.relnamespace
  JOIN unnest(c.conkey) WITH ORDINALITY s(attnum, ord) ON TRUE
  JOIN unnest(c.confkey) WITH ORDINALITY t(attnum, ord) ON s.ord = t.ord
  JOIN pg_attribute sa ON sa.attrelid=st.oid AND sa.attnum=s.attnum
  JOIN pg_attribute ta ON ta.attrelid=tt.oid AND ta.attnum=t.attnum
  WHERE c.contype='f' AND sn.nspname NOT IN ('pg_catalog','information_schema')
  GROUP BY sn.nspname, st.relname, c.conname, tn.nspname, tt.relname
  ORDER BY 1,2,3;
`);

await client.end();

// → Assemble Markdown
const byTable = new Map();
for (const r of cols) {
  const key = `${r.table_schema}.${r.table_name}`;
  if (!byTable.has(key)) byTable.set(key, []);
  byTable.get(key).push(r);
}

let md = '# Database Schema\n\n';

for (const [key, rows] of [...byTable.entries()].sort()) {
  md += `## ${key}\n\n`;
  md += '| # | Column | Type | Nullable | Default | Comment |\n';
  md += '|---:|---|---|:--:|---|---|\n';
  for (const r of rows) {
    md += `| ${r.ordinal_position} | \`${r.column_name}\` | \`${r.data_type}\` | ${r.is_nullable === 'YES' ? 'YES' : 'NO'} | ${r.column_default ?? ''} | ${r.column_comment ?? ''} |\n`;
  }

  // PK
  const tablePks = pks.filter(p => `${p.schema}.${p.table}` === key);
  for (const p of tablePks) {
    md += `\n**PK** \`${p.pk_name}\`: (${p.cols.join(', ')})\n`;
  }

  // FKs
  const tableFks = fks.filter(f => `${f.src_schema}.${f.src_table}` === key);
  if (tableFks.length) {
    md += `\n**FKs**\n`;
    for (const f of tableFks) {
      md += `- \`${f.fk_name}\`: (${f.src_cols.join(', ')}) → ${f.tgt_schema}.${f.tgt_table} (${f.tgt_cols.join(', ')})\n`;
    }
  }

  md += '\n';
}

await fs.mkdir('docs', { recursive: true });
await fs.writeFile('docs/db-schema.md', md, 'utf8');
console.log('Wrote docs/db-schema.md');
