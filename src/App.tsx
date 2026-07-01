import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { Suspense } from "react";

// Lazy load pages so a crash in one doesn't kill the others
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const VibeCoding = React.lazy(() => import("./pages/VibeCoding"));
const Superagent = React.lazy(() => import("./pages/Superagent"));
const EmployeeDashboard = React.lazy(() => import("./pages/EmployeeDashboard"));
const SharedProject = React.lazy(() => import("./pages/SharedProject"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageFallback = ({ name }: { name: string }) => (
  <div style={{ padding: 40, fontFamily: "monospace", color: "#ef4444", background: "#0a0a0a", minHeight: "100vh" }}>
    <h2>⚡ {name} failed to load</h2>
    <p>Check the browser console for details.</p>
    <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", background: "#7c3aed", color: "white", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 16 }}>
      Reload
    </button>
  </div>
);

class PageErrorBoundary extends React.Component<{ name: string; children: React.ReactNode }, { crashed: boolean; error?: Error }> {
  state = { crashed: false };
  static getDerivedStateFromError(e: Error) { return { crashed: true, error: e }; }
  componentDidCatch(e: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.name}] crashed:`, e.message, info.componentStack?.slice(0, 300));
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: this.props.name, error: e.message, stack: e.stack }),
    }).catch(() => {});
  }
  render() {
    if (this.state.crashed) return <PageFallback name={this.props.name} />;
    return this.props.children;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            <PageErrorBoundary name="LandingPage">
              <Suspense fallback={<div style={{ background: "#0a0a0a", minHeight: "100vh" }} />}>
                <LandingPage />
              </Suspense>
            </PageErrorBoundary>
          } />
          <Route path="/vibe" element={
            <PageErrorBoundary name="VibeCoding">
              <Suspense fallback={<div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c3aed", fontFamily: "monospace" }}>Loading VibeCoding...</div>}>
                <VibeCoding />
              </Suspense>
            </PageErrorBoundary>
          } />
          <Route path="/superagent" element={
            <PageErrorBoundary name="Superagent">
              <Suspense fallback={<div style={{ background: "#0a0a0a", minHeight: "100vh" }}>Loading...</div>}>
                <Superagent />
              </Suspense>
            </PageErrorBoundary>
          } />
          <Route path="/employee" element={
            <PageErrorBoundary name="EmployeeDashboard">
              <Suspense fallback={<div style={{ background: "#0a0a0a", minHeight: "100vh" }}>Loading...</div>}>
                <EmployeeDashboard />
              </Suspense>
            </PageErrorBoundary>
          } />
          <Route path="/project/:id" element={
            <PageErrorBoundary name="SharedProject">
              <Suspense fallback={<div style={{ background: "#0a0a0a", minHeight: "100vh" }}>Loading...</div>}>
                <SharedProject />
              </Suspense>
            </PageErrorBoundary>
          } />
          <Route path="*" element={
            <Suspense fallback={null}>
              <NotFound />
            </Suspense>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
