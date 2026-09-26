// "donar" is the value stored in existing Firestore documents, so it is kept as is.
export const ROLES = Object.freeze({
  DONOR: "donar",
  HOSPITAL: "hospital",
  ORGANISATION: "organisation",
});
export const ROLE_LIST = Object.values(ROLES);

// Where each role keeps its display name on the user document.
export const NAME_FIELD = Object.freeze({
  [ROLES.DONOR]: "name",
  [ROLES.HOSPITAL]: "hospitalName",
  [ROLES.ORGANISATION]: "organisationName",
});

// Which field of a blood record points at a user of each role.
export const RECORD_FIELD = Object.freeze({
  [ROLES.DONOR]: "donar",
  [ROLES.HOSPITAL]: "hospital",
  [ROLES.ORGANISATION]: "organisation",
});

export const USER_STATUS = Object.freeze({ ACTIVE: "active", SUSPENDED: "suspended" });

// Hospitals and blood banks are checked by an admin before they can record or receive blood.
// Donors are approved on sign-up. Accounts created before approval existed count as approved.
export const VERIFICATION = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});
export const VERIFICATION_LIST = Object.values(VERIFICATION);
export const APPROVAL_ROLES = Object.freeze([ROLES.HOSPITAL, ROLES.ORGANISATION]);

// "in": blood received from a donor. "out": blood issued to a hospital.
export const INVENTORY_TYPES = Object.freeze({ IN: "in", OUT: "out" });
export const INVENTORY_TYPE_LIST = Object.values(INVENTORY_TYPES);

export const BLOOD_GROUPS = Object.freeze(["O+", "O-", "AB+", "AB-", "A+", "A-", "B+", "B-"]);

// Every "in" record is one blood unit (one bag). "available": can still be issued or discarded.
// "issued": every ML of it has gone to a hospital (see `consumedQuantity`). "discarded": thrown away,
// never issued. "legacy": added before units existed, kept only for history, never issued or discarded.
export const UNIT_STATUS = Object.freeze({
  AVAILABLE: "available",
  ISSUED: "issued",
  DISCARDED: "discarded",
  LEGACY: "legacy",
});

export const DISCARD_REASONS = Object.freeze([
  "expired",
  "contaminated",
  "damaged",
  "failed_testing",
  "other",
]);

// A hospital's request for blood from one blood bank. "fulfilled" means the blood bank issued it
// (an ordinary "out" record, linked back to the request); "pending" is the only state either side can
// still act on. There is no separate "approved but not yet issued" state: fulfilling issues right away.
export const REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  FULFILLED: "fulfilled",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
});
export const REQUEST_STATUS_LIST = Object.values(REQUEST_STATUS);

export const REQUEST_PRIORITY = Object.freeze({
  NORMAL: "normal",
  URGENT: "urgent",
  EMERGENCY: "emergency",
});
export const REQUEST_PRIORITY_LIST = Object.values(REQUEST_PRIORITY);

// The kind of blood product a request is for. Informational only: stock itself is tracked by blood
// group and ML alone, not by component, the same as every other blood bank in this app.
export const REQUEST_COMPONENT = Object.freeze({
  WHOLE_BLOOD: "whole_blood",
  PLASMA: "plasma",
  PLATELETS: "platelets",
  RBC: "rbc",
  CRYOPRECIPITATE: "cryoprecipitate",
});
export const REQUEST_COMPONENT_LIST = Object.values(REQUEST_COMPONENT);

export const LIMITS = Object.freeze({
  NAME: 100,
  ADDRESS: 200,
  CITY: 100,
  WEBSITE: 200,
  REASON: 200,
  DISCARD_NOTE: 200,
  REQUEST_NOTE: 300,
  PATIENT_NAME: 100,
  CONTACT_NAME: 100,
  CONTACT_PHONE: 20,
  REGISTRATION_NUMBER: 60,
  SEARCH: 100,
  MAX_QUANTITY_ML: 50_000,
  MIN_ADMIN_PASSWORD: 12,
  // Admin lists read at most this many documents per request.
  MAX_SCAN: 2000,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE_SIZE: 25,
  CAMP_NAME: 100,
  CAMP_DESCRIPTION: 300,
  // A GPS fix reporting itself as worse than this (metres) is not worth showing on a map.
  MAX_LOCATION_ACCURACY_M: 50_000,
  MAX_UNITS_OFFERED: 20,
});

// A blood camp is a one-off or recurring event at a fixed venue, run by one organisation (blood bank).
// "suspended" is an admin moderation state, independent of whether the camp's dates have passed.
export const CAMP_STATUS = Object.freeze({ ACTIVE: "active", SUSPENDED: "suspended" });

// One standard whole-blood donation, in ML. Used only to turn a request's ML amount into a rough
// "how many donors does this need" count for the donor-matching flow; stock itself stays tracked in ML.
export const STANDARD_UNIT_ML = 450;

// Within this radius of a request's location (when both the request and a candidate donor have a
// known location) a donor counts as "nearby" for eligibility. Candidates on either side with no known
// location are never excluded by distance alone, only by blood group and role.
export const ELIGIBILITY_RADIUS_KM = 25;

// Who may donate to whom, by blood group: BLOOD_COMPATIBLE_DONORS[recipient] lists every donor group
// that can safely give blood to that recipient (the standard compatibility chart, e.g. O- gives to
// everyone, AB+ can receive from everyone).
export const BLOOD_COMPATIBLE_DONORS = Object.freeze({
  "O-": ["O-"],
  "O+": ["O+", "O-"],
  "A-": ["A-", "O-"],
  "A+": ["A+", "A-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "AB-": ["AB-", "A-", "B-", "O-"],
  "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"],
});

// A response to a blood request, offering some number of units. "pending" awaits the requester's
// decision; "confirmed" counts toward the request's required units; "declined" was turned down by the
// requester; "withdrawn" was pulled back by the responder before either happened.
export const RESPONSE_STATUS = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  DECLINED: "declined",
  WITHDRAWN: "withdrawn",
});
export const RESPONSE_STATUS_LIST = Object.values(RESPONSE_STATUS);

// What a notification is about. Notifications are addressed to one hospital or blood bank account and
// shown on its website (never something a person has to open just to find a request: every request is
// also listed on the Requests page itself).
export const NOTIFICATION_TYPE = Object.freeze({
  REQUEST_NEW: "request.new", // a request was raised in the organisation's city, or sent straight to it
  REQUEST_RESPONSE: "request.response", // someone offered to help with the organisation's request
  REQUEST_UPDATE: "request.update", // a request the organisation answered was fulfilled / cancelled / rejected
  RESPONSE_DECISION: "response.decision", // the requester confirmed or declined the organisation's offer
  RESPONSE_DISPATCHED: "response.dispatched", // blood was sent against an offer the organisation's request accepted
  STOCK_LOW: "stock.low",
  ACCOUNT_DECISION: "account.decision", // an admin approved or rejected the registration
});
export const NOTIFICATION_TYPE_LIST = Object.values(NOTIFICATION_TYPE);

// Longer, free-form text limits used by the hospital / blood bank website.
export const ORG_LIMITS = Object.freeze({
  EMAIL: 120,
  ABOUT: 500,
  HOURS: 100,
  STATE: 80,
  PINCODE: 12,
  BAG_NUMBER: 40,
  STORAGE: 60,
  UNIT_NOTE: 200,
  REFERENCE: 60,
  MAX_SHELF_DAYS: 400,
});
