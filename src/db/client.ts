import "server-only";
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
type Tx = postgres.TransactionSql;

const globalForDb = globalThis as unknown as { __gestureRackSql?: Sql };

/** Lazy connection pool. Returns null when DATABASE_URL is not configured. */
export function getSql(): Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  globalForDb.__gestureRackSql ??= postgres(url, {
    max: 5,
    connect_timeout: 5,
    idle_timeout: 20,
    prepare: false,
  });
  return globalForDb.__gestureRackSql;
}

export class DbUnavailableError extends Error {
  constructor() {
    super("Database is not configured");
  }
}

/**
 * Run queries as the RLS-restricted app role with app.owner_id set for this
 * transaction only, so policies in db/migrations isolate each owner's rows.
 */
export async function withOwner<T>(ownerId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const sql = getSql();
  if (!sql) throw new DbUnavailableError();
  const result = await sql.begin(async (tx) => {
    await tx`set local statement_timeout = '5s'`;
    await tx`set local role gesture_app`;
    await tx`select set_config('app.owner_id', ${ownerId}, true)`;
    return fn(tx);
  });
  return result as T;
}
