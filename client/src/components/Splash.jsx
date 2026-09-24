/** Shown for a moment while the app checks who is signed in. */
export default function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <img className="splash-logo" src="/logo.png" alt="" />
      <p className="splash-name">Blood Bank</p>
      <p className="splash-tagline">Connecting donors with those in need</p>
      <div className="splash-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
