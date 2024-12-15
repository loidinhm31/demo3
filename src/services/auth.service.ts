import axiosInstance from "./axios.config";
import { AuthResponse, LoginRequest, RegisterRequest, TokenRefreshResponse, User } from "@/types/auth";

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

class AuthService {
  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await axiosInstance.post<ApiResponse<AuthResponse>>("/auth/login", data);
      if (!response.data.success) {
        throw new Error(response.data.error || "Login failed");
      }
      return response.data.data!;
    } catch (error: any) {
      // Even for 401 status, the error response is in error.response.data
      if (error.response.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error("Unable to connect to the server. Please try again later.");
    }
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await axiosInstance.post<ApiResponse<AuthResponse>>("/auth/register", data);
      if (!response.data.success) {
        throw new Error(response.data.error || "Registration failed");
      }
      return response.data.data!;
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error("Unable to complete registration. Please try again later.");
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const response = await axiosInstance.get<ApiResponse<User>>("/auth/me");
      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to fetch user data");
      }
      return response.data.data!;
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error("Unable to fetch user data. Please try again later.");
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResponse> {
    try {
      const response = await axiosInstance.post<ApiResponse<TokenRefreshResponse>>("/auth/refresh", { refreshToken });
      if (!response.data.success) {
        throw new Error(response.data.error || "Token refresh failed");
      }
      return response.data.data!;
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error("Unable to refresh authentication. Please login again.");
    }
  }

  async logout(): Promise<void> {
    try {
      await axiosInstance.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
      // Even if the server request fails, we should clear local storage
    } finally {
      // Always clear local storage
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  }
}

export const authService = new AuthService();
