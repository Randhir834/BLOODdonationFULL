import { Link } from "react-router-dom";
import { Icon } from "../../components/Status";

/** What is NOT happening: shortages, silence, missing sign-ups. `severity` is critical, warning or info. */
export default function Attention({ items }) {
  if (items.length === 0) {
    return (
      <div className="all-good">
        <Icon name="good" size={20} />
        <span>Nothing needs attention right now.</span>
      </div>
    );
  }

  return (
    <ul className="attention">
      {items.map((item) => (
        <li key={item.title}>
          <Icon name={item.severity} size={18} />
          <div>
            <div className="title">{item.title}</div>
            {item.detail && <div className="detail">{item.detail}</div>}
            {item.link && (
              <div className="detail">
                <Link to={item.link.to}>{item.link.label}</Link>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
