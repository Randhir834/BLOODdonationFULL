import { Component } from "react";
import AuthShell from "./AuthShell";
import { Icon } from "./Icon";

/** Catches a crash while rendering so people see a way forward instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <AuthShell>
        <div className="fatal">
          <Icon name="alertCircle" size={40} />
          <h1>Something went wrong</h1>
          <p className="lead">The app hit an unexpected problem. Reloading usually fixes it.</p>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => window.location.reload()}>
          <Icon name="refresh" size={18} /> Reload
        </button>
      </AuthShell>
    );
  }
}
