import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import "./styles/app.css";
import App, { preloadScreens } from "./app/App";
import { store } from "./app/store";
import ConfigError from "./components/ConfigError";
import ErrorBoundary from "./components/ErrorBoundary";
import OnboardingGate from "./components/OnboardingGate";
import { initAuth } from "./features/auth/authService";
import { missingConfig } from "./lib/env";
import { initAnalytics } from "./lib/firebase";

const root = ReactDOM.createRoot(document.getElementById("root"));

if (missingConfig.length) {
  root.render(<ConfigError missing={missingConfig} />);
} else {
  initAuth(store.dispatch);
  preloadScreens();
  initAnalytics();
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <Provider store={store}>
          <BrowserRouter>
            <OnboardingGate>
              <App />
            </OnboardingGate>
          </BrowserRouter>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
