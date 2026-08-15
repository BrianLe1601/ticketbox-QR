import mysql, { type RowDataPacket } from "mysql2/promise";
import { env } from "../config/env.js";

interface DatabaseInfoRow extends RowDataPacket {
  databaseName: string;
  databaseVersion: string;
}

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  charset: "utf8mb4",
  timezone: "+07:00",
  decimalNumbers: true,
});

export async function checkDatabaseConnection(): Promise<{
  databaseName: string;
  databaseVersion: string;
}> {
  const [rows] = await pool.query<DatabaseInfoRow[]>(
    `
      SELECT
        DATABASE() AS databaseName,
        VERSION() AS databaseVersion
    `,
  );

  const result = rows[0];

  if (!result) {
    throw new Error("Database did not return connection information");
  }

  return {
    databaseName: result.databaseName,
    databaseVersion: result.databaseVersion,
  };
}