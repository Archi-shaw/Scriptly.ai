import "server-only";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

let dummyHash: Promise<string> | null = null;

/**
 * Compares a password with a stored hash. When there is no hash (unknown
 * email, Google-only account) it still runs a bcrypt comparison so response
 * timing does not reveal whether the account exists.
 */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    dummyHash ??= bcrypt.hash("scriptly-timing-equaliser", SALT_ROUNDS);
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}
