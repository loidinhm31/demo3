import { BrowserRouter } from "react-router-dom";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { getRoutes } from "@/core/routeConfig";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

// Lazy load components
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const LoadingFallback = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Card className="w-[300px]">
      <CardContent className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading...</span>
      </CardContent>
    </Card>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="light" storageKey="ui-theme">
        <AuthProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              {getRoutes().map((route) => {
                const Component = route.component;
                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      route.isSecure ? (
                        <ProtectedRoute>
                          <Component />
                        </ProtectedRoute>
                      ) : (
                        <Component />
                      )
                    }
                  />
                );
              })}
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
