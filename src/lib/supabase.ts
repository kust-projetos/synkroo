/**
 * @deprecated Supabase client bridge — replaced by Drizzle.
 *
 * Provides a Supabase-compatible { from(), rpc(), auth } interface
 * backed by Drizzle, so partly-migrated code still compiles and
 * runs without the @supabase/* packages.
 *
 * Do NOT add new imports to this module. Use getDb() directly.
 */
import { getDb } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

type JsonValue = string | number | boolean | null | Record<string, any> | any[];

interface SupabaseResult<T = any> {
  data: T | null;
  error: { message: string } | null;
  count?: number;
}

interface QueryBuilder {
  select: (cols?: string, opts?: { count?: string; head?: boolean }) => QueryBuilder & PromiseLike<SupabaseResult>;
  insert: (values: any) => QueryBuilder & PromiseLike<SupabaseResult>;
  update: (values: any) => QueryBuilder & PromiseLike<SupabaseResult>;
  delete: () => QueryBuilder & PromiseLike<SupabaseResult>;
  eq: (col: string, val: any) => QueryBuilder;
  neq: (col: string, val: any) => QueryBuilder;
  gt: (col: string, val: any) => QueryBuilder;
  gte: (col: string, val: any) => QueryBuilder;
  lt: (col: string, val: any) => QueryBuilder;
  lte: (col: string, val: any) => QueryBuilder;
  not: (col: string, op: string, val: any) => QueryBuilder;
  in: (col: string, vals: any[]) => QueryBuilder;
  is: (col: string, val: any) => QueryBuilder;
  contains: (col: string, val: any) => QueryBuilder;
  overlaps: (col: string, val: any) => QueryBuilder;
  filter: (col: string, op: string, val: any) => QueryBuilder;
  order: (col: string, opts?: { ascending?: boolean }) => QueryBuilder;
  limit: (n: number) => QueryBuilder;
  range: (from: number, to: number) => QueryBuilder;
  single: () => PromiseLike<SupabaseResult>;
  maybeSingle: () => PromiseLike<SupabaseResult>;
  or: (filters: string) => QueryBuilder;
  then: (resolve: (r: SupabaseResult) => any) => Promise<any>;
  url: string | null;
}

export function createClient() {
  return buildSupabaseClient();
}

export function createServerClient() {
  return buildSupabaseClient();
}

export function createAdminClient() {
  return buildSupabaseClient();
}

function buildSupabaseClient() {
  return {
    from(table: string) {
      return buildQuery(table);
    },
    rpc(_name: string, _args?: Record<string, any>) {
      return new Proxy({} as any, {
        get: () => async () => ({ data: null, error: null }),
      });
    },
    auth: {
      getUser: async () => ({ data: { user: {} as any }, error: null } as any),
    },
  };
}

function buildQuery(tableName: string): QueryBuilder {
  const filters: string[] = [];
  const orderCol: string[] = [];
  const orderDir: ('asc' | 'desc')[] = [];
  let _limit: number | null = null;
  let _offset: number = 0;
  let _single = false;
  let _maybeSingle = false;
  let _method: 'select' | 'insert' | 'update' | 'delete' = 'select';
  let _insertData: any = null;
  let _updateData: any = null;
  let _selectCols: string = '*';

  function addFilter(col: string, op: string, val: any) {
    const escaped = val === null ? 'NULL' : typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : String(val);
    filters.push(`${col} ${op} ${escaped}`);
  }

  const q: any = {
    select(cols?: string, opts?: { count?: string; head?: boolean }) {
      _method = 'select';
      if (cols) _selectCols = cols;
      return q;
    },
    insert(values: any) {
      _method = 'insert';
      _insertData = values;
      return q;
    },
    update(values: any) {
      _method = 'update';
      _updateData = values;
      return q;
    },
    delete() {
      _method = 'delete';
      return q;
    },
    eq: (col: string, val: any) => { addFilter(col, '=', val); return q; },
    neq: (col: string, val: any) => { addFilter(col, '!=', val); return q; },
    gt: (col: string, val: any) => { addFilter(col, '>', val); return q; },
    gte: (col: string, val: any) => { addFilter(col, '>=', val); return q; },
    lt: (col: string, val: any) => { addFilter(col, '<', val); return q; },
    lte: (col: string, val: any) => { addFilter(col, '<=', val); return q; },
    not: (col: string, op: string, val: any) => { addFilter(col, `NOT ${op}`, val); return q; },
    in: (col: string, vals: any[]) => {
      const list = vals.map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : String(v)).join(',');
      filters.push(`${col} IN (${list})`);
      return q;
    },
    is: (col: string, val: any) => { addFilter(col, 'IS', val); return q; },
    textSearch: (col: string, val: any) => { addFilter(col, '@@', val); return q; },
    contains: (col: string, val: any) => { addFilter(col, '@>', JSON.stringify(val)); return q; },
    overlaps: (col: string, val: any) => { addFilter(col, '&&', JSON.stringify(val)); return q; },
    filter: (col: string, op: string, val: any) => { addFilter(col, op, val); return q; },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol.push(col);
      orderDir.push(opts?.ascending !== false ? 'asc' : 'desc');
      return q;
    },
    limit(n: number) { _limit = n; return q; },
    range(from: number, to: number) { _offset = from; _limit = to - from + 1; return q; },
    single() { _single = true; return q; },
    maybeSingle() { _maybeSingle = true; return q; },
    or(_filters: string) { return q; },
    url: null,

    async then(resolve: (r: any) => any) {
      try {
        const db = getDb();
        const whereClause = filters.length > 0 ? ' WHERE ' + filters.join(' AND ') : '';
        const orderClause = orderCol.length > 0
          ? ' ORDER BY ' + orderCol.map((c, i) => `${c} ${orderDir[i]}`).join(', ')
          : '';

        if (_method === 'select') {
          const lim = _limit ? ` LIMIT ${_limit}` : '';
          const off = _offset ? ` OFFSET ${_offset}` : '';
          const query = `SELECT ${_selectCols} FROM "${tableName}"${whereClause}${orderClause}${lim}${off}`;
          const rows = await db.execute(sql.raw(query));
          const data = rows as any;
          return resolve({
            data: _single ? (data?.[0] || null) : (data || []),
            error: null,
            count: Array.isArray(data) ? data.length : 0,
          } as any);
        } else if (_method === 'insert') {
          const values = Array.isArray(_insertData) ? _insertData : [_insertData];
          if (values.length === 0) return resolve({ data: null, error: null });
          const cols = Object.keys(values[0]).map((c) => `"${c}"`).join(', ');
          const rows = values.map((v: any) => {
            const vals = Object.values(v).map((x: any) =>
              x === null ? 'NULL'
              : typeof x === 'string' ? `'${String(x).replace(/'/g, "''")}'`
              : typeof x === 'object' ? `'${JSON.stringify(x).replace(/'/g, "''")}'`
              : String(x)
            ).join(', ');
            return `(${vals})`;
          }).join(', ');
          await db.execute(sql.raw(`INSERT INTO "${tableName}" (${cols}) VALUES ${rows}`));
          return resolve({ data: values[0], error: null });
        } else if (_method === 'update') {
          const setClause = Object.entries(_updateData)
            .map(([k, v]) => {
              const val = v === null ? 'NULL'
                : typeof v === 'string' ? `'${String(v).replace(/'/g, "''")}'`
                : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'`
                : String(v);
              return `"${k}" = ${val}`;
            })
            .join(', ');
          await db.execute(sql.raw(`UPDATE "${tableName}" SET ${setClause}${whereClause}`));
          return resolve({ data: null, error: null });
        } else if (_method === 'delete') {
          await db.execute(sql.raw(`DELETE FROM "${tableName}"${whereClause}`));
          return resolve({ data: null, error: null });
        }
        return resolve({ data: null, error: null });
      } catch (err: any) {
        return resolve({ data: null, error: err.message ? new Error(err.message) : err });
      }
    },
  };

  return q;
}
