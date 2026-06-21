import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Rendering error in MindHack component:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return <div className="p-4 text-red-500">Error loading Mind Hack modal.</div>;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
