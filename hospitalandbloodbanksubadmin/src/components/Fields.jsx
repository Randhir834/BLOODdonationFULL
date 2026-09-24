import { useId } from "react";
import { BLOOD_GROUPS, QUICK_AMOUNTS } from "../lib/constants";
import { fmtNum } from "../lib/format";
import { COUNTRIES, ENABLED_COUNTRIES } from "../lib/phone";

// Every field here is blank until the person types: no example text, no pre-loaded value. The label above it
// says what to enter, and an error under it says what is wrong.

function Label({ id, label, optional }) {
  return (
    <label className="field-label" htmlFor={id}>
      {label}
      {optional && <span className="muted"> (optional)</span>}
    </label>
  );
}

function Message({ id, error, hint }) {
  if (error) {
    return (
      <div id={id} className="field-error" role="alert">
        {error}
      </div>
    );
  }
  return hint ? (
    <div id={id} className="field-hint">
      {hint}
    </div>
  ) : null;
}

/** A single-line input. `onChange` gets the text. */
export function TextField({ label, value, onChange, error, hint, optional, className = "", ...input }) {
  const id = useId();
  return (
    <div className={`field-group ${className}`.trim()}>
      <Label id={id} label={label} optional={optional} />
      <input
        id={id}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        onChange={(event) => onChange(event.target.value)}
        {...input}
      />
      <Message id={`${id}-msg`} error={error} hint={hint} />
    </div>
  );
}

export function TextArea({ label, value, onChange, error, hint, optional, className = "", ...input }) {
  const id = useId();
  return (
    <div className={`field-group ${className}`.trim()}>
      <Label id={id} label={label} optional={optional} />
      <textarea
        id={id}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        onChange={(event) => onChange(event.target.value)}
        {...input}
      />
      <Message id={`${id}-msg`} error={error} hint={hint} />
    </div>
  );
}

/** A dropdown. `options` is [{ value, label }]; the first, empty choice says what to pick. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  choose = "Choose",
  error,
  hint,
  optional,
  className = "",
}) {
  const id = useId();
  return (
    <div className={`field-group ${className}`.trim()}>
      <Label id={id} label={label} optional={optional} />
      <select
        id={id}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{choose}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Message id={`${id}-msg`} error={error} hint={hint} />
    </div>
  );
}

/**
 * A mobile number: the country code and the digits after it, in one bordered control. `value` is just the
 * digits; turn it into +E164 with `toE164(value, COUNTRIES[country].code)` when submitting.
 */
export function PhoneField({
  label,
  value,
  onChange,
  country,
  onCountry,
  error,
  hint,
  optional,
  className = "",
  autoFocus,
}) {
  const id = useId();
  const current = COUNTRIES[country];
  return (
    <div className={`field-group ${className}`.trim()}>
      <Label id={id} label={label} optional={optional} />
      <div className={`phone ${error ? "invalid" : ""}`.trim()}>
        {ENABLED_COUNTRIES.length > 1 && onCountry ? (
          <select
            className="cc"
            aria-label="Country"
            value={country}
            onChange={(event) => onCountry(event.target.value)}
          >
            {ENABLED_COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {code} {COUNTRIES[code].code}
              </option>
            ))}
          </select>
        ) : (
          <span className="cc">{current.code}</span>
        )}
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the number is the first thing asked on its screen
          autoFocus={autoFocus}
          maxLength={current.digits}
          value={value}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        />
      </div>
      <Message id={`${id}-msg`} error={error} hint={hint} />
    </div>
  );
}

/** The eight blood groups as buttons, none chosen until one is pressed. */
export function GroupPicker({ label = "Blood group", value, onChange, error, disabled = false }) {
  const id = useId();
  return (
    <div className="field-group">
      <span className="field-label" id={id}>
        {label}
      </span>
      <div className="grid-groups" role="group" aria-labelledby={id}>
        {BLOOD_GROUPS.map((group) => (
          <button
            type="button"
            key={group}
            className="gbtn"
            aria-pressed={value === group}
            disabled={disabled}
            onClick={() => onChange(group)}
          >
            {group}
          </button>
        ))}
      </div>
      {error && (
        <div className="field-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

/** An amount in ML with one-tap common bag sizes. */
export function AmountField({ label = "Amount (ML)", value, onChange, error, hint, optional }) {
  const id = useId();
  return (
    <div className="field-group">
      <Label id={id} label={label} optional={optional} />
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
      />
      <div className="amount-chips" role="group" aria-label="Common bag sizes">
        {QUICK_AMOUNTS.map((amount) => (
          <button
            type="button"
            key={amount}
            className="btn btn-small"
            aria-pressed={value === String(amount)}
            onClick={() => onChange(String(amount))}
          >
            {fmtNum(amount)}
          </button>
        ))}
      </div>
      <Message id={`${id}-msg`} error={error} hint={hint} />
    </div>
  );
}

/** A yes / no tick. */
export function CheckField({ label, checked, onChange }) {
  const id = useId();
  return (
    <div className="check-row">
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
