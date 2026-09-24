import { APPROVAL_ROLES } from "../../constants/index.js";
import * as audit from "../../services/auditService.js";
import {
  createUser,
  displayName,
  findOrganisationByRegistration,
  findUserById,
} from "../../services/userService.js";
import { HttpError } from "../../utils/HttpError.js";

// POST /org/auth/register: first sign-in of a verified phone number creates a hospital / blood bank account,
// which then waits for an admin to approve it.
export const register = async (req, res) => {
  const { role, name, address, city, website, registrationNumber, ...profile } = req.validated.body;
  if (await findOrganisationByRegistration(registrationNumber)) {
    throw new HttpError(
      409,
      "This registration number is already registered. Sign in with the phone number it was registered with."
    );
  }
  const user = await createUser(req.auth.uid, req.auth.phone, {
    role,
    name,
    address,
    city,
    website,
    registrationNumber,
    profile,
  });
  if (!user) throw new HttpError(409, "This account is already set up");
  await audit.recordActivity(
    user,
    "user.register",
    { type: "user", id: user._id, label: displayName(user) },
    { role: user.role, verification: user.verification, via: "website" }
  );
  res.status(201).json({ success: true, user });
};

// GET /org/auth/me: `user` is null until the account has been created. A donor's account is refused here.
export const me = async (req, res) => {
  const user = await findUserById(req.auth.uid);
  if (user && !APPROVAL_ROLES.includes(user.role)) {
    throw new HttpError(403, "This website is for hospitals and blood banks. Donors use the mobile app.");
  }
  res.json({ success: true, user });
};
