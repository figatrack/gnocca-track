import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect, useState } from "react";
import { getTheme, getStoredUser, shouldShowIntro } from "@/lib/storage";
import { DevSwitch } from "@/components/dev-switch";
import { LandscapeBlocker } from "@/components/landscape-blocker";

const MapPage = lazy(() => import("@/pages/map"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const AdminPage = lazy(() => import("@/pages/admin"));
const IntroPage = lazy(() => import("@/pages/intro"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function AppRoutes() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const user = getStoredUser();
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const relativePath = window.location.pathname.replace(base, "") || "/";
    if (!user && relativePath !== "/onboarding") {
      navigate("/onboarding");
    }
  }, [navigate]);

  return (
    <Switch>
      <Route path="/" component={MapPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/admin" component={AdminPage} />
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
  return <div className="fixed inset-0 bg-background" />;
}

export default function App() {
  const [showIntro, setShowIntro] = useState(() => shouldShowIntro());

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

          <Suspense fallback={<AppFallback />}>
            {showIntro ? (
              <IntroPage onDone={() => setShowIntro(false)} />
            ) : (
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AppRoutes />
                <DevSwitch />
              </WouterRouter>
            )}
          </Suspense>
        </ThemeProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
