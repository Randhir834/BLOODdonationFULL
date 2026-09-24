export const PAGE_SIZE = 25;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// "donar" is the value the API stores for donors, people see "Donor".
export const ROLE_LABEL = { donar: "Donor", hospital: "Hospital", organisation: "Organisation" };

// Hospitals and blood banks must be approved by an admin before they can use the app. Donors are not.
export const APPROVAL_ROLES = ["hospital", "organisation"];
export const VERIFICATION_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

// The name field's label in the edit form, by role.
export const NAME_LABEL = { donar: "Name", hospital: "Hospital name", organisation: "Organisation name" };

// A blood unit's lifecycle. "expired" is not stored: it means "available" past its expiry date.
export const UNIT_STATUS_LABEL = {
  available: "Available",
  issued: "Issued",
  discarded: "Discarded",
  expired: "Expired",
  legacy: "Legacy",
};

// A blood request's lifecycle. "expired" is not stored: it means "pending" past its needed-by date.
export const REQUEST_STATUS_LABEL = {
  pending: "Waiting",
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
