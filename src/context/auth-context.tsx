import React, { createContext, useContext, useEffect, useState } from "react";
import { authService } from "@/services/auth.service";
import { AuthResponse, LoginRequest, RegisterRequest, User } from "@/types/auth";

interface AuthContextType {
  user: User | null;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error("Error loading user:", error);
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const handleAuthResponse = (response: AuthResponse) => {
    localStorage.setItem("accessToken", response.accessToken);
    localStorage.setItem("refreshToken", response.refreshToken);
    setUser({
      id: 0, // This will be updated when we fetch the full user profile
      email: response.email,
      name: response.name,
      provider: "LOCAL",
      roles: ["ROLE_USER"],
      enabled: true,
    });
  };

  const login = async (data: LoginRequest) => {
    try {
      setError(null);
      const response = await authService.login(data);
      handleAuthResponse(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred during login";
      setError(message);
      throw err;
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      setError(null);
      const response = await authService.register(data);
      handleAuthResponse(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred during registration";
      setError(message);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading, error }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
