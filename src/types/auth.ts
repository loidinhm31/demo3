export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  email: string;
  name: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  provider: "EMAIL" | "GOOGLE";
  roles: string[];
  enabled: boolean;
  imageUrl?: string | null;
  providerId?: string | null;
}

export interface JwtPayload {
  sub: string;
  roles: string;
  is2faEnabled?: boolean;
  exp: number;
  iat: number;
}