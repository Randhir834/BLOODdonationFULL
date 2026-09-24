// "donar" is the value the API stores and returns for donors, so it is kept as is.
export const ROLES = Object.freeze({
  DONOR: "donar",
  HOSPITAL: "hospital",
  ORGANISATION: "organisation",
});

// People see "Donor", never "donar".
export const ROLE_LABEL = Object.freeze({
  [ROLES.DONOR]: "Donor",
  [ROLES.HOSPITAL]: "Hospital",
  [ROLES.ORGANISATION]: "Blood bank",
});

export const RECORD_TYPES = Object.freeze({ IN: "in", OUT: "out" });

export const BLOOD_GROUPS = Object.freeze(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);

// Reasons a blood bank can give for throwing away a unit that was never issued.
export const DISCARD_REASON_LABEL = Object.freeze({
  expired: "Past its expiry date",
  contaminated: "Contaminated",
  damaged: "Damaged",
  failed_testing: "Failed testing",
  other: "Other",
});
export const DISCARD_REASONS = Object.freeze(Object.keys(DISCARD_REASON_LABEL));

export const REQUEST_PRIORITY_LABEL = Object.freeze({
  normal: "Normal",
  urgent: "Urgent",
  emergency: "Emergency",
});
export const REQUEST_PRIORITIES = Object.freeze(Object.keys(REQUEST_PRIORITY_LABEL));

export const REQUEST_STATUS_LABEL = Object.freeze({
  pending: "Waiting",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  cancelled: "Cancelled",
});

export const REQUEST_COMPONENT_LABEL = Object.freeze({
  whole_blood: "Whole blood",
  plasma: "Plasma",
  platelets: "Platelets",
  rbc: "Red blood cells",
  cryoprecipitate: "Cryoprecipitate",
});
export const REQUEST_COMPONENTS = Object.freeze(Object.keys(REQUEST_COMPONENT_LABEL));

export const RESPONSE_STATUS_LABEL = Object.freeze({
  pending: "Waiting",
  confirmed: "Confirmed",
  declined: "Declined",
  withdrawn: "Withdrawn",
});
