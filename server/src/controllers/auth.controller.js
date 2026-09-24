import * as audit from "../services/auditService.js";
import { customTokenForPhone } from "../services/authService.js";
import { createUser, displayName, findUserById, updateOwnProfile } from "../services/userService.js";
import { HttpError } from "../utils/HttpError.js";

// POST /auth/phone-login (development only, mounted when ALLOW_PHONE_LOGIN=true)
export const phoneLogin = async (req, res) => {
  const token = await customTokenForPhone(req.validated.body.phone);
  res.json({ success: true, token });
};

// POST /auth/register: first sign-in of a verified phone number creates the profile
export const register = async (req, res) => {
  const user = await createUser(req.auth.uid, req.auth.phone, req.validated.body);
  if (!user) throw new HttpError(409, "This account is already set up");
  await audit.recordActivity(
    user,
    "user.register",
    { type: "user", id: user._id, label: displayName(user) },
    {
      role: user.role,
      verification: user.verification,
    }
  );
  res.status(201).json({ success: true, user });
};

// GET /auth/me: `user` is null until the profile has been created
export const me = async (req, res) => {
  res.json({ success: true, user: await findUserById(req.auth.uid) });
};

// PATCH /auth/me: the signed-in user edits their own address and city
export const updateMe = async (req, res) => {
  const current = await findUserById(req.auth.uid);
  if (!current) throw new HttpError(404, "This account is not set up yet");
  const user = await updateOwnProfile(current, req.validated.body);
  await audit.recordActivity(user, "user.update-profile", { type: "user", id: user._id, label: displayName(user) });
  res.json({ success: true, user });
};
