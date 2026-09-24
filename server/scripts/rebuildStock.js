// Repair tool: recomputes the blood-in-stock totals shown on the admin dashboard from every record.
// Usage: npm run rebuild-stock
import { rebuildStock } from "../src/services/stockService.js";

try {
  const { records } = await rebuildStock();
  console.log(`Stock totals rebuilt from ${records} records.`);
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
