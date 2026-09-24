// One-off migration: introduces blood units (unit id, expiry, status) to existing "in" records that
// predate them, and creates one opening-balance unit per organisation and blood group so their current
// stock is still available to issue. See migrateLegacyRecordsToUnits for exactly what it does. Safe to
// run more than once. Usage: npm run migrate-units
import { migrateLegacyRecordsToUnits } from "../src/services/inventoryService.js";

try {
  const { legacyRecordsTagged, openingBalanceUnitsCreated } = await migrateLegacyRecordsToUnits();
  console.log(`Tagged ${legacyRecordsTagged} pre-unit record(s) as legacy.`);
  console.log(`Created ${openingBalanceUnitsCreated} opening-balance unit(s).`);
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
