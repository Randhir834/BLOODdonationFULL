export const PAGE_SIZE = 25;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// The two kinds of account that use this website. "organisation" is the value the API stores for a blood bank.
export const ROLES = Object.freeze({ HOSPITAL: "hospital", BANK: "organisation" });
export const ROLE_LABEL = { hospital: "Hospital", organisation: "Blood bank" };
export const NAME_FIELD = { hospital: "hospitalName", organisation: "organisationName" };

// One standard unit (bag) of whole blood, in ML: a request counts blood in units of this size.
export const UNIT_ML = 450;
// Common bag sizes, offered as one-tap amounts.
export const QUICK_AMOUNTS = [250, 350, 450, 500];

export const VERIFICATION_LABEL = {
  pending: "Waiting for approval",
  approved: "Approved",
  rejected: "Not approved",
};

// A blood unit's lifecycle. "expired" is not stored: it means "available" past its expiry date.
export const UNIT_STATE_LABEL = {
  available: "In stock",
  expired: "Expired",
  issued: "Used up",
  discarded: "Discarded",
  legacy: "Legacy",
};

export const MOVEMENT_LABEL = { received: "Received", issued: "Issued", discarded: "Discarded" };

export const DISCARD_REASON_LABEL = {
  expired: "Past its expiry date",
  contaminated: "Contaminated",
  damaged: "Damaged",
  failed_testing: "Failed testing",
  other: "Other",
};

export const REQUEST_STATUS_LABEL = {
  pending: "Open",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
};
export const REQUEST_PRIORITY_LABEL = { normal: "Normal", urgent: "Urgent", emergency: "Emergency" };
export const REQUEST_COMPONENT_LABEL = {
  whole_blood: "Whole blood",
  plasma: "Plasma",
  platelets: "Platelets",
  rbc: "Red blood cells",
  cryoprecipitate: "Cryoprecipitate",
};
export const RELATION_LABEL = { mine: "Raised by you", addressed: "Sent to you", city: "In your city" };

export const RESPONSE_STATUS_LABEL = {
  pending: "Waiting for the requester",
  confirmed: "Confirmed",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

// What people did, in the account's activity log.
export const ACTION_LABEL = {
  "user.register": "Registered the organisation",
  "user.update-profile": "Edited the profile",
  "user.resubmit": "Sent the registration for review again",
  "inventory.add": "Received blood",
  "inventory.issue": "Issued blood",
  "inventory.update": "Corrected a unit",
  "inventory.discard": "Discarded a unit",
  "inventory.receive-shipment": "Confirmed a delivery",
  "request.create": "Raised a blood request",
  "request.update": "Edited a blood request",
  "request.fulfil": "Fulfilled a blood request",
  "request.reject": "Rejected a blood request",
  "request.cancel": "Cancelled a blood request",
  "request.dispatch": "Issued blood for a request",
  "response.create": "Offered blood for a request",
  "response.confirm": "Confirmed an offer",
  "response.decline": "Declined an offer",
  "response.withdraw": "Withdrew an offer",
  "camp.create": "Added a blood camp",
  "camp.update": "Edited a blood camp",
  "camp.remove": "Removed a blood camp",
};
