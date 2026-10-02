import { beforeEach, expect, it, vi } from "vitest";

const bcrypt = vi.hoisted(() => ({ hash: vi.fn(), compare: vi.fn() }));
vi.mock("bcrypt", () => ({ default: bcrypt }));
const repo = vi.hoisted(() => ({
  findActiveUserById: vi.fn(), findGoogleStaffBySub: vi.fn(), findUserByEmail: vi.fn(), registerPendingGoogleStaff: vi.fn(),
  lockActiveAdmin: vi.fn(), replacePasswordAndRevokeSessions: vi.fn(), transaction: vi.fn(), updateAdminFullName: vi.fn(),
}));
vi.mock("../src/modules/auth/auth.repository.js", () => repo);
vi.mock("../src/modules/auth/auth-session.repository.js", () => ({
  createSession: vi.fn(), lockSession: vi.fn(), pool: {}, replaceSession: vi.fn(), revokeSession: vi.fn(),
}));
import { changeAdminPassword, updateAdminProfile } from "../src/modules/auth/auth.service.js";

const admin = { id: 7, full_name: "Admin", email: "admin@example.com", password_hash: "old-hash", role: "admin", is_active: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  repo.transaction.mockImplementation((work) => work({}));
  repo.lockActiveAdmin.mockResolvedValue(admin);
  repo.updateAdminFullName.mockResolvedValue({ ...admin, full_name: "Tên mới" });
  bcrypt.hash.mockResolvedValue("new-hash");
  bcrypt.compare.mockResolvedValue(true);
});

it("returns the updated Admin identity without exposing the password hash", async () => {
  await expect(updateAdminProfile(7, { fullName: "Tên mới" })).resolves.toEqual({ id: 7, fullName: "Tên mới", email: "admin@example.com", role: "admin" });
  expect(repo.updateAdminFullName).toHaveBeenCalledWith(7, "Tên mới");
});

it("changes the password and revokes sessions in one transaction", async () => {
  await changeAdminPassword(7, { currentPassword: "OldPassword1", newPassword: "newpassword@2" });
  expect(bcrypt.compare).toHaveBeenCalledWith("OldPassword1", "old-hash");
  expect(repo.replacePasswordAndRevokeSessions).toHaveBeenCalledWith(expect.anything(), 7, "new-hash");
});

it("does not update when the current password is wrong", async () => {
  bcrypt.compare.mockResolvedValue(false);
  await expect(changeAdminPassword(7, { currentPassword: "WrongPass1", newPassword: "newpassword@2" })).rejects.toMatchObject({ code: "CURRENT_PASSWORD_INVALID" });
  expect(repo.replacePasswordAndRevokeSessions).not.toHaveBeenCalled();
});
