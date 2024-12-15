import axios, { AxiosHeaders, AxiosResponse, CreateAxiosDefaults, InternalAxiosRequestConfig } from "axios";

interface CustomInternalAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
}

const config: CreateAxiosDefaults = {
  baseURL: "http://localhost:8080/api",
  headers: new AxiosHeaders({
    "Content-Type": "application/json",
  }),
  withCredentials: true,
};

const axiosInstance = axios.create(config);

// List of routes that should skip the refresh token attempt
const skipAuthRefreshRoutes = ["/auth/login", "/auth/register", "/auth/refresh"];

// Add a request interceptor
axiosInstance.interceptors.request.use(
  (config: CustomInternalAxiosRequestConfig) => {
    // Check if this route should skip auth refresh
    const url = config.url || "";
    const baseURL = config.baseURL || "";
    const path = url.replace(baseURL, "");

    config.skipAuthRefresh = skipAuthRefreshRoutes.some((route) => path.includes(route));

    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Add a response interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: any) => {
    console.log("Axios interceptor error:", error);
    console.log("Error response:", error?.response);
    console.log("Error response data:", error?.response?.data);

    // Re-throw the error to be caught by the service
    return Promise.reject(error);
  },
);

export default axiosInstance;
