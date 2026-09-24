// Creates the FIRST admin for the admin website (later admins can be added from the website itself).
// Usage: npm run create-admin -- admin@example.com "Full Name"
// The password is asked for without echo (min 12 characters).
import { LIMITS } from "../src/constants/index.js";
import { createAdminAccount } from "../src/services/adminAccountService.js";

const [email, name] = process.argv.slice(2);

// Reads a line from the terminal without printing what is typed.
const askPassword = (label) =>
  new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(label);

    // Piped input (no terminal): read the first line.
    if (!stdin.isTTY) {
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (data += chunk));
      stdin.on("end", () => resolve(data.split(/\r?\n/)[0]));
      return;
    }

    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onKey = (key) => {
      if (key === "\u0003") process.exit(1); // ctrl+c
      if (key === "\r" || key === "\n" || key === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onKey);
        stdout.write("\n");
        return resolve(value);
      }
      value = key === "\u007f" || key === "\b" ? value.slice(0, -1) : value + key;
    };
    stdin.on("data", onKey);
  });

try {
  if (!email) {
    console.log('Usage: npm run create-admin -- admin@example.com "Full Name"');
    process.exit(1);
  }
  const password = await askPassword(`Password (min ${LIMITS.MIN_ADMIN_PASSWORD} characters): `);
  const admin = await createAdminAccount({ email, password, name }, "create-admin script");
  console.log(`Admin created: ${admin.email}. Sign in on the admin website.`);
  process.exit(0);
} catch (error) {
  if (error.status) {
    console.error(`Error: ${error.message}`);
  } else if (error.code === "auth/configuration-not-found") {
    console.error(
      "Firebase Authentication is not turned on yet: Firebase console > Build > Authentication > Get started, then enable Email/Password."
    );
  } else {
    console.error(error);
  }
  process.exit(1);
}
