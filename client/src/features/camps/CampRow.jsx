import { Icon } from "../../components/Icon";
import { fmtDay } from "../../lib/format";

const monthOf = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short" });
const dayOf = (iso) => new Date(`${iso}T00:00:00`).getDate();

/** One camp an organisation runs, with edit/delete actions. */
export default function CampRow({ camp, busy, onEdit, onDelete }) {
  const suspended = camp.status === "suspended";
  const oneDay = camp.startDate === camp.endDate;
  return (
    <li className="row row-lead">
      <div className="datetile" aria-hidden="true">
        <b>{dayOf(camp.startDate)}</b>
        <span>{monthOf(camp.startDate)}</span>
      </div>
      <div className="main">
        <div className="title-line">
          <div className="title">{camp.name}</div>
          {suspended && <span className="chip chip-urgent">Under review</span>}
        </div>
        <div className="sub">{camp.address}</div>
        <div className="sub strong">
          {oneDay ? fmtDay(camp.startDate) : `${fmtDay(camp.startDate)} – ${fmtDay(camp.endDate)}`}
        </div>
        {suspended && <div className="sub">Hidden from the map until it has been reviewed.</div>}
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onEdit(camp)}>
          <Icon name="edit" size={16} />
          Edit
        </button>
        <button type="button" className="link-btn link-btn-sm" disabled={busy} onClick={() => onDelete(camp)}>
          Delete
        </button>
      </div>
    </li>
  );
}
