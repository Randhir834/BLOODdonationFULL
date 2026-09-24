import { useRef, useState } from "react";
import { Icon } from "./Icon";

// The first launch shows what the app does using small, real-looking pieces of its own screens.
function StockMock() {
  const tiles = [
    ["A+", "4,250", 74],
    ["B+", "3,100", 54],
    ["O+", "5,800", 100],
    ["O-", "250", 8],
  ];
  return (
    <div className="ob-card ob-stock">
      {tiles.map(([group, value, level]) => (
        <div className="ob-tile" key={group}>
          <span className="k">{group}</span>
          <span className="v">{value}</span>
          <span className="u">ML</span>
          <span className="meter">
            <span style={{ width: `${level}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function RequestMock() {
  return (
    <div className="ob-card ob-request">
      <div className="ob-request-head">
        <span className="tag">O-</span>
        <div className="ob-request-text">
          <div className="title-line">
            <span className="title">Ravi Kumar</span>
            <span className="chip chip-emergency">Emergency</span>
          </div>
          <span className="sub">900 ML · 12 min ago</span>
          <span className="sub">City Hospital, Ward 2</span>
        </div>
      </div>
      <div className="ob-request-actions">
        <span className="btn btn-sm btn-primary">Respond</span>
      </div>
    </div>
  );
}

function RolesMock() {
  const roles = [
    ["drop", "Donors", "Give blood and track it"],
    ["hospital", "Hospitals", "Ask for blood in minutes"],
    ["building", "Blood banks", "Manage stock and requests"],
  ];
  return (
    <div className="ob-card ob-roles">
      {roles.map(([icon, title, text]) => (
        <div className="ob-role" key={title}>
          <Icon name={icon} />
          <span>
            <b>{title}</b>
            <small>{text}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

const SCREENS = [
  {
    key: "welcome",
    eyebrow: "Welcome",
    title: "Welcome to Blood Bank",
    description:
      "One trusted place to donate, request and track blood, built for donors, hospitals and blood banks.",
    visual: <RolesMock />,
  },
  {
    key: "stock",
    eyebrow: "Live inventory",
    title: "See blood stock in real time",
    description:
      "Check availability by blood group, recent activity and donation history the moment it changes.",
    visual: <StockMock />,
  },
  {
    key: "respond",
    eyebrow: "Fast response",
    title: "Respond in a few taps",
    description:
      "Hospitals can request blood instantly, and donors and blood banks nearby can step in when it matters.",
    visual: <RequestMock />,
  },
];

const LAST = SCREENS.length - 1;
const SWIPE_THRESHOLD = 40;

/** Shown once on first launch, before sign-in. Drag, swipe or tap through, or skip straight to sign-in. */
export default function Onboarding({ onFinish }) {
  const [step, setStep] = useState(0);
  const drag = useRef(null);

  const go = (next) => setStep(Math.min(Math.max(next, 0), LAST));

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, dx: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    drag.current.dx = e.clientX - drag.current.x;
  };
  const onPointerUp = () => {
    const dx = drag.current?.dx || 0;
    drag.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    go(dx < 0 ? step + 1 : step - 1);
  };

  return (
    <div className="onboarding">
      <p className="sr" aria-live="polite">
        Screen {step + 1} of {SCREENS.length}: {SCREENS[step].title}
      </p>
      <div className="onboarding-top">
        <button
          type="button"
          className="icon-btn"
          style={{ visibility: step === 0 ? "hidden" : "visible" }}
          onClick={() => go(step - 1)}
          aria-label="Back"
        >
          <Icon name="chevronLeft" />
        </button>
        <div className="onboarding-brand">
          <img src="/logo.png" alt="" />
          <span>Blood Bank</span>
        </div>
        <button type="button" className="link-btn" onClick={onFinish}>
          Skip
        </button>
      </div>

      <div
        className="onboarding-track-wrap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="onboarding-track"
          style={{ transform: `translateX(-${step * 100}%)` }}
          aria-hidden="true"
        >
          {SCREENS.map((screen, i) => (
            <div className="onboarding-slide" key={screen.key}>
              <div className={`onboarding-slide-inner ${i === step ? "is-active" : ""}`}>
                <div className="onboarding-visual">{screen.visual}</div>
                <p className="onboarding-eyebrow">{screen.eyebrow}</p>
                <h1>{screen.title}</h1>
                <p className="onboarding-desc">{screen.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="onboarding-bottom">
        <div className="onboarding-dots" role="tablist" aria-label="Onboarding progress">
          {SCREENS.map((screen, i) => (
            <button
              key={screen.key}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`Screen ${i + 1} of ${SCREENS.length}`}
              className="onboarding-dot"
              onClick={() => go(i)}
            />
          ))}
        </div>

        {step === LAST ? (
          <button type="button" className="btn btn-primary btn-block" onClick={onFinish}>
            Get started
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={() => go(step + 1)}>
            Next
            <Icon name="arrowRight" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
