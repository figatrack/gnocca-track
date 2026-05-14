import { Redirect, Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Component, lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getTheme, getStoredUser, shouldShowIntro } from "@/lib/storage";
import { DevSwitch } from "@/components/dev-switch";
import { LandscapeBlocker } from "@/components/landscape-blocker";

const MapPage = lazy(() => import("@/pages/map"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const AdminPage = lazy(() => import("@/pages/admin"));
const IntroPage = lazy(() => import("@/pages/intro"));
const NotFound = lazy(() => import("@/pages/not-found"));

const ADMIN_ROUTE = "/admina";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function AppRoutes() {
  const [location] = useLocation();
  const user = getStoredUser();
  const canEnterWithoutProfile = location === "/onboarding" || location === ADMIN_ROUTE || location === "/admin";

  if (!user && !canEnterWithoutProfile) {
    return <Redirect to="/onboarding" replace />;
  }

  return (
    <Switch>
      <Route path="/" component={MapPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path={ADMIN_ROUTE} component={AdminPage} />
      <Route path="/admin">
        <Redirect to={ADMIN_ROUTE} replace />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = getTheme();
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, []);
  return <>{children}</>;
}

function AppFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="h-14 w-14 rounded-3xl shadow-[0_0_40px_rgba(255,8,128,0.35)]"
          style={{ background: "linear-gradient(135deg, #FF0880 0%, #D90072 100%)" }}
        />
        <p className="text-sm font-bold text-foreground">Caricamento...</p>
      </div>
    </div>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background px-6 text-center">
          <div className="flex max-w-xs flex-col items-center gap-4">
            <div
              className="h-14 w-14 rounded-3xl shadow-[0_0_40px_rgba(255,8,128,0.35)]"
              style={{ background: "linear-gradient(135deg, #FF0880 0%, #D90072 100%)" }}
            />
            <div className="space-y-2">
              <h1 className="text-lg font-black text-foreground">Errore di caricamento</h1>
              <p className="text-sm font-medium text-muted-foreground">
                Ricarica l'app per aggiornare i file locali.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-12 rounded-full bg-primary px-8 text-sm font-black text-primary-foreground shadow-lg"
            >
              Ricarica
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [showIntro, setShowIntro] = useState(() => shouldShowIntro());
  const handleIntroDone = useCallback(() => setShowIntro(false), []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const base = import.meta.env.BASE_URL;
      navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          {/* Landscape blocker — always mounted, shown via CSS media query */}
          <LandscapeBlocker />

          <AppErrorBoundary>
            <Suspense fallback={<AppFallback />}>
              {showIntro ? (
                <IntroPage onDone={handleIntroDone} />
              ) : (
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <AppRoutes />
                  <DevSwitch />
                </WouterRouter>
              )}
            </Suspense>
          </AppErrorBoundary>
        </ThemeProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
