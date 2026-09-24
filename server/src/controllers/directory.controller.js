import { RECORD_FIELD, ROLES } from "../constants/index.js";
import { distinctValues } from "../services/inventoryService.js";
import { findUsersByIds, listApprovedOrganisations } from "../services/userService.js";

// Profiles of the users found in `field` of the records that match `filters`.
const profilesIn = async (field, filters) => findUsersByIds(await distinctValues(field, filters));

// GET /directory/donors (organisations): donors the organisation has recorded blood from
export const donors = async (req, res) => {
  const found = await profilesIn(RECORD_FIELD[ROLES.DONOR], { organisation: req.user._id });
  res.json({ success: true, donors: found });
};

// GET /directory/hospitals (organisations): hospitals the organisation has issued blood to
export const hospitals = async (req, res) => {
  const found = await profilesIn(RECORD_FIELD[ROLES.HOSPITAL], { organisation: req.user._id });
  res.json({ success: true, hospitals: found });
};

// GET /directory/organisations (donors, hospitals): blood banks that have dealt with the user
export const organisations = async (req, res) => {
  const found = await profilesIn(RECORD_FIELD[ROLES.ORGANISATION], {
    [RECORD_FIELD[req.user.role]]: req.user._id,
  });
  res.json({ success: true, organisations: found });
};

// GET /directory/blood-banks: every active, approved blood bank, to ask for blood from, whether or not
// it has dealt with this user before (unlike /organisations above). A blood bank never sees itself here.
export const bloodBanks = async (req, res) => {
  const banks = (await listApprovedOrganisations()).filter((bank) => bank._id !== req.user._id);
  res.json({ success: true, organisations: banks });
};
