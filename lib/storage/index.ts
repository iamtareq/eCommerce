import "server-only";

/**
 * Server-only entry point. The implementation lives in ./drivers so scripts that run
 * outside Next.js (prisma/seed-demo.ts) can use the same upload code.
 */
export * from "./drivers";
