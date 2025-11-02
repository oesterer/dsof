import { createPool, Pool, RowDataPacket } from 'mysql2/promise';
import { databaseConfig } from './config.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = createPool({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    });
  }
  return pool;
}

export type Row<T> = T & RowDataPacket;

export async function shutdownPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
