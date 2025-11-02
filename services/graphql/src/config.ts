import fs from 'fs';
import os from 'os';
import path from 'path';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  database: string;
  password: string;
}

function loadPassword(): string {
  const envPassword = process.env.MYSQL_DSOF_PASSWORD;
  if (envPassword && envPassword.trim().length > 0) {
    return envPassword.trim();
  }

  const passwordPath = path.join(os.homedir(), '.apikeys', 'mysql_dsof');
  try {
    const fileContents = fs.readFileSync(passwordPath, 'utf8');
    return fileContents.trim();
  } catch (error) {
    throw new Error(
      `Unable to read MySQL password from ${passwordPath}. ` +
        'Provide the password via the MYSQL_DSOF_PASSWORD environment variable or ensure the file exists.'
    );
  }
}

export const databaseConfig: DatabaseConfig = {
  host: process.env.MYSQL_DSOF_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_DSOF_PORT ?? '3306'),
  user: process.env.MYSQL_DSOF_USER ?? 'dsof',
  database: process.env.MYSQL_DSOF_DATABASE ?? 'dsof',
  password: loadPassword(),
};

export const serverConfig = {
  port: Number(process.env.PORT ?? '4000'),
};
