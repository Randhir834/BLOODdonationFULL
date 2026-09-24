import { Icon } from "../../components/Icon";
import { RECORD_TYPES } from "../../lib/constants";
import { daysUntil, fmtDate, fmtDay, fmtNum, fmtTime } from "../../lib/format";

const EXPIRY_WARNING_DAYS = 7;

// A blood bank's own "in" records carry unit fields; other people's views of the same records do not.
const unitNote = (record) => {
  if (record.status === "discarded") return { text: "Discarded" };
  if (record.status === "available" && record.expiresAt) {
    const days = daysUntil(record.expiresAt);
    if (days < 0) return { text: "Expired", warn: true };
    if (days <= EXPIRY_WARNING_DAYS)
      return { text: `Expires in ${days} ${days === 1 ? "day" : "days"}`, warn: true };
    return { text: `Expires ${fmtDay(record.expiresAt)}` };
  }
  return null;
};

/**
 * One blood movement. `title` is who it was with. `time` shows only the clock (when a day heading is
 * above). `onDiscard`, if given, offers to discard the unit (only shown while it is still available).
 */
export default function RecordRow({ record, title, time = false, onDiscard }) {
  const added = record.inventoryType === RECORD_TYPES.IN;
  const note = unitNote(record);
  const discardable = added && record.status === "available" && onDiscard;
  return (
    <li className="row row-tagged">
      <span className="tag">{record.bloodGroup}</span>
      <div className="main">
        <div className="title">{title}</div>
        <div className="sub">
          {added ? "Added" : "Issued"} · {time ? fmtTime(record.createdAt) : fmtDate(record.createdAt)}
        </div>
        {note && <div className={`sub ${note.warn ? "warn" : ""}`.trim()}>{note.text}</div>}
      </div>
      <div className={`amount ${added ? "in" : ""}`}>
        {added ? "+" : "−"}
        {fmtNum(record.quantity)}
        <small>ML</small>
      </div>
      {discardable && (
        <div className="row-actions">
          <button type="button" className="btn btn-sm" onClick={() => onDiscard(record)}>
            <Icon name="trash" size={16} />
            Discard
          </button>
        </div>
      )}
    </li>
  );
}
