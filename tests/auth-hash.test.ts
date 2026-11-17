import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";

describe("AC 6.1 - Authentication Security", () => {
  it("hashes password with bcrypt and matches correct password", async () => {
    const rawPassword = "passwordSuperAman123";
    const hash = await bcrypt.hash(rawPassword, 10);

    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);

    const isMatch = await bcrypt.compare(rawPassword, hash);
    expect(isMatch).toBe(true);

    const isWrong = await bcrypt.compare("wrongPassword", hash);
    expect(isWrong).toBe(false);
  });
});
