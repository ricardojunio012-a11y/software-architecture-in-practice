// The database port that the modules' code uses. In the latency fitness function, the
// implementation counts the queries and the rows of each request.
export interface Db {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}
