import { COUNTRIES, ENABLED_COUNTRIES, toE164 } from "../../lib/phone";

const COUNTRY = COUNTRIES[ENABLED_COUNTRIES[0]];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Every field of the organisation form, blank. `open24x7` is "", "true" or "false". */
export const emptyProfile = () => ({
  name: "",
  registrationNumber: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  contactPerson: "",
  email: "",
  alternatePhone: "",
  emergencyPhone: "",
  website: "",
  hours: "",
  about: "",
  open24x7: "",
});

const PHONE_FIELDS = ["alternatePhone", "emergencyPhone"];

/**
 * Checks the form and returns { field: message }. Registering needs the basics; editing checks only what was
 * typed, since a blank field there means "keep what is saved".
 */
export const validateProfile = (values, { editing, needsRegistration = true }) => {
  const errors = {};
  const need = (field, message) => {
    if (!editing && !values[field].trim()) errors[field] = message;
  };
  need("name", "Enter the name.");
  if (needsRegistration) need("registrationNumber", "Enter the registration or licence number.");
  need("address", "Enter the address.");
  need("city", "Enter the city.");
  if (values.email.trim() && !EMAIL.test(values.email.trim())) errors.email = "Enter a valid email address.";
  PHONE_FIELDS.forEach((field) => {
    if (values[field] && values[field].length !== COUNTRY.digits) {
      errors[field] = `Enter a ${COUNTRY.digits}-digit number.`;
    }
  });
  return errors;
};

/** The API body: everything for a new account, only what was typed for an edit. */
export const profileBody = (values, { editing }) => {
  const text = (field) => values[field].trim();
  const body = {};
  [
    "name",
    "registrationNumber",
    "address",
    "city",
    "state",
    "pincode",
    "contactPerson",
    "website",
    "hours",
    "about",
  ].forEach((field) => {
    if (!editing || text(field)) body[field] = text(field);
  });
  if (!editing || text("email")) body.email = text("email");
  PHONE_FIELDS.forEach((field) => {
    if (values[field]) body[field] = toE164(values[field], COUNTRY.code);
    else if (!editing) body[field] = "";
  });
  if (values.open24x7 !== "") body.open24x7 = values.open24x7 === "true";
  else if (!editing) body.open24x7 = false;
  return body;
};

export const PHONE_COUNTRY = ENABLED_COUNTRIES[0];
