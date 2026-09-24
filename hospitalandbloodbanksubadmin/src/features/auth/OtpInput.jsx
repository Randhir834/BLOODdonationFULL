import { useEffect, useRef, useState } from "react";

/**
 * Six boxes that behave like one field: one real <input> sits on top (so typing, paste, backspace and
 * the phone's SMS auto-fill all work natively) and the boxes just show what is typed.
 */
export default function OtpInput({ value, onChange, length = 6, invalid = false, disabled = false }) {
  const input = useRef(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!disabled) input.current?.focus();
  }, [disabled, invalid]);

  const active = Math.min(value.length, length - 1);
  return (
    // Clicking a box focuses the real input; keyboard users reach the input itself.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="otp" onClick={() => input.current?.focus()}>
      <input
        ref={input}
        className="otp-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={length}
        value={value}
        disabled={disabled}
        aria-label={`${length}-digit verification code`}
        aria-invalid={invalid}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
      />
      {Array.from({ length }, (_, index) => (
        <div
          key={index}
          className={[
            "otp-cell",
            focused && !disabled && index === active && "active",
            value[index] && "filled",
            invalid && "invalid",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          {value[index] || ""}
        </div>
      ))}
    </div>
  );
}
