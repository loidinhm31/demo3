import React, { lazy, Suspense } from "react";

const Login = lazy(() => import("@/pages/login-page"));
const Home = lazy(() => import("@/pages/home-page"));

export interface Route {
  path: string;
  pageTitle: string;
  component: React.LazyExoticComponent<React.FC>;
  isSecure: boolean;
  permission: string[];
  subPages?: Route[];
}

export const RoutePaths = {
  HOME: "/home",
  LOGIN: "/login",
  EMPTY: "/empty",
  ARM_BOT: "/arm-bot",
  UNAUTHORIZED: "/unauthorized",
} as const;

export const routes: Route[] = [
  {
    path: RoutePaths.HOME,
    pageTitle: "Home",
    component: Home,
    isSecure: true,
    permission: [],
    subPages: [],
  },
  {
    path: RoutePaths.LOGIN,
    pageTitle: "Login",
    component: Login,
    isSecure: false,
    permission: [],
    subPages: [],
  },
];

export const getRoutes = (initRoutes = routes): Route[] => {
  const flattenRoutes = (routes: Route[]): Route[] => {
    return routes.reduce<Route[]>((acc, route) => {
      acc.push(route);
      if (route.subPages && route.subPages.length > 0) {
        acc.push(...flattenRoutes(route.subPages));
      }
      return acc;
    }, []);
  };

  return flattenRoutes(initRoutes);
};
