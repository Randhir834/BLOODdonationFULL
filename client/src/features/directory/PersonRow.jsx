import { Icon } from "../../components/Icon";
import { formatPhone, initialOf, nameOf } from "../../lib/format";

/** A donor, hospital or blood bank with a call button. */
export default function PersonRow({ person }) {
  return (
    <li className="row row-avatar">
      <span className="avatar">{initialOf(person)}</span>
      <div className="main">
        <div className="title">{nameOf(person)}</div>
        <div className="sub">{person.address || "No address"}</div>
        <div className="sub num">{formatPhone(person.phone)}</div>
      </div>
      {person.phone && (
        <a
          className="icon-btn icon-btn-outline"
          href={`tel:${person.phone}`}
          aria-label={`Call ${nameOf(person)}`}
        >
          <Icon name="phone" size={20} />
        </a>
      )}
    </li>
  );
}
