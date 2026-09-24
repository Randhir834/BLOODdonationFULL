import { useState } from "react";
import Onboarding from "./Onboarding";

const KEY = "bb.onboarded";

function hasOnboarded() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // storage unavailable: don't block the app on it
  }
}

/** Shows the onboarding carousel once, before anything else, on a device that has never completed or skipped it. */
export default function OnboardingGate({ children }) {
  const [done, setDone] = useState(hasOnboarded);

  if (done) return children;

  const finish = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // storage unavailable: onboarding may show again next launch, which is fine
    }
    setDone(true);
  };

  return <Onboarding onFinish={finish} />;
}
