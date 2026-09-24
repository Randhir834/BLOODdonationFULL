import { api } from "../../lib/api";

/** Donors a blood bank has recorded blood from. */
export const listDonors = () => api.get("/directory/donors").then((response) => response.data.donors);

/** Hospitals a blood bank has issued blood to. */
export const listHospitals = () =>
  api.get("/directory/hospitals").then((response) => response.data.hospitals);

/** Blood banks that have dealt with the signed-in donor or hospital. */
export const listOrganisations = () =>
  api.get("/directory/organisations").then((response) => response.data.organisations);

/** Every active, approved blood bank, for a hospital to pick from when asking for blood. */
export const listBloodBanks = () =>
  api.get("/directory/blood-banks").then((response) => response.data.organisations);
