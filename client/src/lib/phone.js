import { env } from "./env";

// Countries the app can send the sign-in SMS to. Firebase must allow the same countries
// (Authentication > Settings > SMS region policy). Pick them with VITE_SMS_COUNTRIES, e.g. "IN,AE".
// `digits` is the length of a mobile number without the country code or a leading zero.
export const COUNTRIES = {
  IN: { name: "India", code: "+91", digits: 10 },
  AE: { name: "United Arab Emirates", code: "+971", digits: 9 },
  SA: { name: "Saudi Arabia", code: "+966", digits: 9 },
  PK: { name: "Pakistan", code: "+92", digits: 10 },
  BD: { name: "Bangladesh", code: "+880", digits: 10 },
  NP: { name: "Nepal", code: "+977", digits: 10 },
  LK: { name: "Sri Lanka", code: "+94", digits: 9 },
  SG: { name: "Singapore", code: "+65", digits: 8 },
  GB: { name: "United Kingdom", code: "+44", digits: 10 },
  US: { name: "United States", code: "+1", digits: 10 },
  CA: { name: "Canada", code: "+1", digits: 10 },
  AU: { name: "Australia", code: "+61", digits: 9 },
};

const enabled = env.smsCountries.filter((id) => COUNTRIES[id]);
export const ENABLED_COUNTRIES = enabled.length ? enabled : ["IN"];

export const DEFAULT_COUNTRY_CODE = COUNTRIES[ENABLED_COUNTRIES[0]].code;

/**
 * ("98765 43210", "+91") or ("+91 98765 43210") -> "+919876543210".
 * Returns null when the input is not a valid number.
 */
export const toE164 = (input, countryCode = DEFAULT_COUNTRY_CODE) => {
  const value = String(input || "").replace(/[\s\-()]/g, "");
  const full = value.startsWith("+") ? value : `${countryCode}${value.replace(/^0+/, "")}`;
  return /^\+[1-9]\d{7,14}$/.test(full) ? full : null;
};
