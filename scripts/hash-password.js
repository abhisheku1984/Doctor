/**
 * Generate an scrypt hash for ADMIN_PASSWORD_HASH.
 * Usage: node scripts/hash-password.js 'your-password'
 */
const crypto = require("crypto");
const plain = process.argv[2];
if (!plain) {
  console.error("Usage: node scripts/hash-password.js 'your-password'");
  process.exit(1);
}
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(plain, salt, 64).toString("hex");
console.log(`scrypt:${salt}:${hash}`);
console.log("\nSet this as ADMIN_PASSWORD_HASH in your environment.");
