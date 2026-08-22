import bcrypt from "bcrypt";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";

import { env } from "../config/env.js";
import { pool } from "./pool.js";

type SeedRole = "admin" | "staff";

interface SeedUser {
  fullName: string;
  email: string;
  role: SeedRole;
}

const seedUsers: SeedUser[] = [
  {
    fullName: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL,
    role: "admin",
  },
  {
    fullName: env.SEED_STAFF_NAME,
    email: env.SEED_STAFF_EMAIL,
    role: "staff",
  },
];

async function upsertUser(
  connection: PoolConnection,
  user: SeedUser,
  passwordHash: string,
): Promise<void> {
  const [result] = await connection.execute<ResultSetHeader>(
    `
      INSERT INTO users (full_name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        password_hash = VALUES(password_hash),
        role = VALUES(role),
        is_active = TRUE
    `,
    [user.fullName, user.email.toLowerCase(), passwordHash, user.role],
  );

  const action = result.affectedRows === 1 ? "created" : "updated";
  console.log(`[seed] ${action}: ${user.email} (${user.role})`);
}

async function seed(): Promise<void> {
  if (env.NODE_ENV === "production") {
    throw new Error("Development seed is disabled in production");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(env.SEED_DEFAULT_PASSWORD, 12);

    for (const user of seedUsers) {
      await upsertUser(connection, user, passwordHash);
    }

    await connection.commit();
    console.log(`[seed] completed: ${seedUsers.length} development users are ready`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

seed()
  .catch((error: unknown) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
