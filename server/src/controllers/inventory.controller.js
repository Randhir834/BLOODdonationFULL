import { INVENTORY_TYPES, RECORD_FIELD } from "../constants/index.js";
import * as audit from "../services/auditService.js";
import { discardUnit, findRecords, populate, recordBlood } from "../services/inventoryService.js";
import { displayName } from "../services/userService.js";

// POST /inventory (organisations): blood in from a donor or out to a hospital
export const create = async (req, res) => {
  const record = await recordBlood({ ...req.validated.body, organisation: req.user._id });
  const adding = record.inventoryType === INVENTORY_TYPES.IN;
  await audit.recordActivity(
    req.user,
    adding ? "inventory.add" : "inventory.issue",
    { type: "inventory", id: record._id, label: `${record.quantity} ML ${record.bloodGroup}` },
    { bloodGroup: record.bloodGroup, quantity: record.quantity, phone: record.phone }
  );
  res.status(201).json({ success: true, record });
};

// POST /inventory/:id/discard (organisations): a unit that was never issued is thrown away
export const discard = async (req, res) => {
  const unit = await discardUnit(
    req.validated.params.id,
    { ...req.validated.body, organisation: req.user._id },
    { label: displayName(req.user) }
  );
  await audit.recordActivity(
    req.user,
    "inventory.discard",
    { type: "inventory", id: req.validated.params.id, label: `${unit.quantity} ML ${unit.bloodGroup}` },
    { bloodGroup: unit.bloodGroup, quantity: unit.quantity, reason: unit.discardReason }
  );
  res.json({ success: true, unit });
};

// GET /inventory (organisations): every record of the organisation, newest first
export const list = async (req, res) => {
  const { records, truncated } = await findRecords({ organisation: req.user._id });
  res.json({ success: true, records: await populate(records, ["donar", "hospital"]), truncated });
};

// GET /inventory/mine?type=&bloodGroup= (donors and hospitals): only the records that involve them
export const mine = async (req, res) => {
  const { type, bloodGroup } = req.validated.query;
  const { records, truncated } = await findRecords({
    [RECORD_FIELD[req.user.role]]: req.user._id,
    inventoryType: type,
    bloodGroup,
  });
  res.json({
    success: true,
    records: await populate(records, ["donar", "hospital", "organisation"]),
    truncated,
  });
};
