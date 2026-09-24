import { BrandMark } from "./Icon";

/**
 * The frame every signed-out screen shares: the logo and name on top, then the screen's own content.
 * On a phone it fills the screen; on a tablet or desktop it becomes one centred, bordered panel.
 */
export default function AuthShell({ children }) {
  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-brand">
          <BrandMark />
          <span>Blood Bank</span>
        </div>
        {children}
      </div>
    </div>
  );
}
