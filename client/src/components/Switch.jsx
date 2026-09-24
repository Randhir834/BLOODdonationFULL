/** A checkbox styled as an on/off switch, used wherever the app needs a single yes/no setting. */
export default function Switch({ checked, onChange, disabled, label }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track" />
    </label>
  );
}
