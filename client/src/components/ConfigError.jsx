import AuthShell from "./AuthShell";
import { Icon } from "./Icon";

/** Shown instead of the app when the build is missing required settings (see .env.example). */
export default function ConfigError({ missing }) {
  return (
    <AuthShell>
      <div className="fatal">
        <Icon name="alertTriangle" size={40} />
        <h1>App is not configured</h1>
        <p className="lead">
          These settings are missing. Add them to client/.env and restart the dev server.
        </p>
      </div>
      <ul className="config-list">
        {missing.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
    </AuthShell>
  );
}
