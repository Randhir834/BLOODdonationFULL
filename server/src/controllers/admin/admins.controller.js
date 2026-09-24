import {
  createAdminAccount,
  listAdminAccounts,
  removeAdminAccount,
} from "../../services/adminAccountService.js";
import * as audit from "../../services/auditService.js";

const target = (admin) => ({ type: "admin", id: admin._id, label: admin.email });

// GET /admins
export const list = async (_req, res) => {
  res.json({ success: true, admins: await listAdminAccounts() });
};

// POST /admins  { email, password, name? }
export const create = async (req, res) => {
  const admin = await createAdminAccount(req.validated.body, req.admin.email);
  await audit.record(req.admin, "admin.create", target(admin));
  res.status(201).json({ success: true, admin });
};

// DELETE /admins/:id
export const remove = async (req, res) => {
  const admin = await removeAdminAccount(req.validated.params.id, req.admin.uid);
  await audit.record(req.admin, "admin.delete", target(admin));
  res.json({ success: true, message: "Admin removed" });
};
