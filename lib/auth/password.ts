import bcrypt from "bcryptjs";

const COST = 12;

// Comparing against a real hash when a username does not exist keeps login
// timing the same for real and unknown accounts.
let dummyHash: Promise<string> | null = null;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    dummyHash ??= bcrypt.hash(crypto.randomUUID(), COST);
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}

/** Password policy for admin accounts. Returns an error message or null. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Password must contain letters and numbers.";
  return null;
}
