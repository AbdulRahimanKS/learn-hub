import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("React render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div
          style={{
            padding: "2rem",
            fontFamily: "monospace",
            background: "#111",
            color: "#ff6b6b",
            minHeight: "100vh",
            boxSizing: "border-box",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <p style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
            ⚠ Render Error
          </p>
          <p style={{ marginBottom: "1rem" }}>
            <strong>{error.name}:</strong> {error.message}
          </p>
          <pre style={{ color: "#aaa", fontSize: "0.8rem", overflow: "auto" }}>
            {error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1.25rem",
              cursor: "pointer",
              background: "#222",
              color: "#fff",
              border: "1px solid #555",
              borderRadius: "4px",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
