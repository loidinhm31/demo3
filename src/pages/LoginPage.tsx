import React, { memo, useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import GoogleButton from "@/components/GoogleButton";
import LoginForm from "@/components/LoginForm";
import { LoginRequest } from "@/types/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";

const LoginPage = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  const form = useForm<LoginRequest>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleBasicLogin = useCallback(
    async (values: LoginRequest) => {
      setIsLoading(true);
      try {
        await login(values);
        toast({
          title: "Success",
          description: "Login successful! Redirecting...",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Login failed";
        toast({
          variant: "destructive",
          title: "Error",
          description: message,
        });
        form.reset({ email: values.email, password: "" });
      } finally {
        setIsLoading(false);
      }
    },
    [login, toast, form],
  );

  const handleGoogleLogin = useCallback(() => {
    const currentUrl = encodeURIComponent(window.location.origin + "/oauth2/callback");
    window.location.assign(`http://localhost:8080/oauth2/authorization/google?redirect_uri=${currentUrl}`);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-8">
      <div className="w-full mx-auto max-w-[400px] space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Welcome back!</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Don't have an account yet?{" "}
            <button onClick={() => navigate("/register")} className="text-primary underline-offset-4 hover:underline">
              Create account
            </button>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Choose your preferred sign in method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <GoogleButton onClick={handleGoogleLogin} loading={isLoading} />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            <LoginForm onSubmit={handleBasicLogin} isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

LoginPage.displayName = "LoginPage";

export default LoginPage;
