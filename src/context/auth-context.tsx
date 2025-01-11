import React, { createContext, useContext, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/services/axios.config";
import { User } from "@/types/auth";

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
}

// Create context with a default value matching the interface
const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {
  },
  currentUser: null,
  setCurrentUser: () => {
  },
  isAdmin: false,
  setIsAdmin: () => {
  }
});

// Export the provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("JWT_TOKEN"));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(localStorage.getItem("IS_ADMIN") === "true");
  const { toast } = useToast();

  const fetchUser = async () => {
    const user = localStorage.getItem("USER");
    if (!user) return;

    try {
      const parsedUser = JSON.parse(user);
      if (parsedUser?.username) {
        const { data } = await axiosInstance.get(`/auth/user`);
        const roles = data.roles;

        if (roles.includes("ROLE_ADMIN")) {
          localStorage.setItem("IS_ADMIN", "true");
          setIsAdmin(true);
        } else {
          localStorage.removeItem("IS_ADMIN");
          setIsAdmin(false);
        }
        setCurrentUser(data);
      }
    } catch (error) {
      console.error("Error fetching current user", error);
      toast({
        title: "Error",
        description: "Error fetching current user"
      });
    }
  };

  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token]);


  return <AuthContext.Provider value={{
    token,
    setToken,
    currentUser,
    setCurrentUser,
    isAdmin,
    setIsAdmin
  }}>{children}</AuthContext.Provider>;
}

// Export the hook as a named constant
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};