import { Router } from "express";
import { env } from "../config/env.js";
import { me, phoneLogin, register, updateMe } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { rateLimiter } from "../middlewares/rateLimit.js";
import { validate } from "../middlewares/validate.js";
import { phoneLoginBody, registerBody, updateProfileBody } from "../validators/auth.validator.js";

// Signing in itself (phone number + OTP) is handled by Firebase in the app, the server only verifies.
const router = Router();

router.post(
  "/register",
  rateLimiter(20, 60 * 60 * 1000),
  authenticate,
  validate({ body: registerBody }),
  register
);
router.get("/me", authenticate, me);
router.patch("/me", authenticate, validate({ body: updateProfileBody }), updateMe);

// DEVELOPMENT ONLY: sign in with a phone number and no OTP. The route does not exist unless enabled,
// and the environment check refuses to start in production with it enabled.
if (env.ALLOW_PHONE_LOGIN) {
  router.post(
    "/phone-login",
    rateLimiter(30, 15 * 60 * 1000),
    validate({ body: phoneLoginBody }),
    phoneLogin
  );
}

export default router;
