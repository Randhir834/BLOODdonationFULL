import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";
import Modal from "./Modal";
import { SheetBody, SheetHeader } from "./Sheet";

/** Phones: the destinations that do not fit in the bottom bar. */
export default function MoreSheet({ items, pathname, onClose }) {
  const isActive = (item) => (item.end ? pathname === item.to : pathname.startsWith(item.to));
  return (
    <Modal labelledBy="more-title" onClose={onClose}>
      <SheetHeader id="more-title" title="More" onClose={onClose} />
      <SheetBody>
        <nav className="group" aria-label="More">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={`menu-row ${isActive(item) ? "active" : ""}`.trim()}
              onClick={onClose}
            >
              <Icon name={item.icon} />
              <span className="label">{item.title}</span>
              <span className="row-chevron">
                <Icon name="chevronRight" size={18} />
              </span>
            </NavLink>
          ))}
        </nav>
      </SheetBody>
    </Modal>
  );
}
