// Repair tool: marks every available blood unit whose expiry date has passed as discarded, reason
// "expired". Nothing depends on this for correctness, available stock already excludes expired units
// live; it only keeps the records themselves, and the discarded totals, tidy. Usage: npm run sweep-expired
import { sweepExpiredUnits } from "../src/services/inventoryService.js";

try {
  const { checked, discarded } = await sweepExpiredUnits();
  console.log(`Checked ${checked} available unit(s), discarded ${discarded} that had expired.`);
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
