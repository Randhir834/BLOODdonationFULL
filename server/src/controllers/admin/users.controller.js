import { NAME_FIELD, RECORD_FIELD, ROLES, USER_STATUS, VERIFICATION } from "../../constants/index.js";
import * as audit from "../../services/auditService.js";
import * as notifications from "../../services/notificationService.js";
import { findRecords, organisationTotals, populate } from "../../services/inventoryService.js";
import {
  deleteUser,
  displayName,
  findUserById,
  listUsers,
  setUserStatus,
  setVerification,
  updateUser,
  verificationOf,
} from "../../services/userService.js";
import { HttpError } from "../../utils/HttpError.js";
import { paginate } from "../../utils/pagination.js";

// Users created before `status` or approval existed count as active and approved.
const withStatus = (user) => ({
  ...user,
  status: user.status || USER_STATUS.ACTIVE,
  verification: verificationOf(user),
});

const target = (user) => ({ type: "user", id: user._id, label: displayName(user) });

const findOr404 = async (id) => {
  const user = await findUserById(id);
  if (!user) throw new HttpError(404, "User not found");
  return user;
};

// GET /users?role=&status=&verification=&q=&page=&pageSize=
export const list = async (req, res) => {
  const { role, status, verification, q, page, pageSize } = req.validated.query;
  const { users, truncated } = await listUsers(role);

  const needle = (q || "").toLowerCase();
  const rows = users.map(withStatus).filter((user) => {
    if (status && user.status !== status) return false;
    if (verification && user.verification !== verification) return false;
    if (!needle) return true;
    return [displayName(user), user.phone, user.address].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(needle)
    );
  });

  const result = paginate(rows, page, pageSize);
  res.json({
    success: true,
    total: result.total,
    page,
    pageSize,
    truncated,
    users: result.rows,
  });
};

// GET /users/:id: the user, their latest 50 records and, for organisations, their stock
export const detail = async (req, res) => {
  const user = withStatus(await findOr404(req.validated.params.id));
  const { records, truncated: recordsTruncated } = await findRecords(
    { [RECORD_FIELD[user.role]]: user._id },
    50
  );
  const orgTotals =
    user.role === ROLES.ORGANISATION ? await organisationTotals(user._id) : { totals: null, truncated: false };
  res.json({
    success: true,
    user,
    stock: orgTotals.totals,
    stockTruncated: orgTotals.truncated,
    records: await populate(records, ["donar", "hospital", "organisation"]),
    recordsTruncated,
  });
};

// PATCH /users/:id  { role?, name?, address?, website? }
export const update = async (req, res) => {
  const before = await findOr404(req.validated.params.id);
  const user = await updateUser(before._id, req.validated.body);

  const pick = (u) => ({
    role: u.role,
    name: u[NAME_FIELD[u.role]],
    address: u.address,
    website: u.website || "",
  });
  await audit.record(req.admin, "user.update", target(user), { before: pick(before), after: pick(user) });
  res.json({ success: true, user: withStatus(user) });
};

// POST /users/:id/suspend  { reason }
export const suspend = async (req, res) => {
  const before = await findOr404(req.validated.params.id);
  const { reason } = req.validated.body;
  const user = await setUserStatus(before._id, USER_STATUS.SUSPENDED, reason);
  await audit.record(req.admin, "user.suspend", target(user), { reason });
  res.json({ success: true, user: withStatus(user) });
};

// POST /users/:id/reactivate
export const reactivate = async (req, res) => {
  const before = await findOr404(req.validated.params.id);
  const user = await setUserStatus(before._id, USER_STATUS.ACTIVE);
  await audit.record(req.admin, "user.reactivate", target(user));
  res.json({ success: true, user: withStatus(user) });
};

// POST /users/:id/approve: a hospital or blood bank may start using the app
export const approve = async (req, res) => {
  const before = await findOr404(req.validated.params.id);
  const user = await setVerification(before._id, VERIFICATION.APPROVED, { adminEmail: req.admin.email });
  await audit.record(req.admin, "user.approve", target(user), {
    registrationNumber: user.registrationNumber,
  });
  await notifications.notifyAccountDecision(user, VERIFICATION.APPROVED);
  res.json({ success: true, user: withStatus(user) });
};

// POST /users/:id/reject  { reason }: the reason is shown to the person and kept in the activity log
export const reject = async (req, res) => {
  const before = await findOr404(req.validated.params.id);
  const { reason } = req.validated.body;
  const user = await setVerification(before._id, VERIFICATION.REJECTED, {
    reason,
    adminEmail: req.admin.email,
  });
  await audit.record(req.admin, "user.reject", target(user), { reason });
  await notifications.notifyAccountDecision(user, VERIFICATION.REJECTED, reason);
  res.json({ success: true, user: withStatus(user) });
};

// DELETE /users/:id: removes the profile and the login (their blood records stay for the organisations)
export const remove = async (req, res) => {
  const user = await findOr404(req.validated.params.id);
  await deleteUser(user._id);
  await notifications.deleteFor(user._id).catch(() => {});
  await audit.record(req.admin, "user.delete", target(user), { role: user.role, phone: user.phone });
  res.json({ success: true, message: "User deleted" });
};
