// ============================================================================
// EEMS - Login Page
// ============================================================================

import { useState, type FormEvent } from "react";

import { useDispatch } from "react-redux";

import { useNavigate } from "react-router-dom";

import { login } from "@/auth/auth.api";

import { setCredentials } from "@/auth/auth.store";

import type { AppDispatch } from "@/auth/store";

import { Button } from "@/components/ui/button";

// ============================================================================
// COMPONENT
// ============================================================================

export function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();

  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");

  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // ==========================================================================
  // SUBMIT
  // ==========================================================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const result = await login({
        identifier: identifier.trim(),

        password,
      });

      dispatch(
        setCredentials({
          accessToken: result.accessToken,

          user: result.user,
        }),
      );

      navigate("/dashboard", {
        replace: true,
      });
    } catch {
      setError("Invalid username, email, employee ID, or password.");
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================================
  // UI
  // ==========================================================================

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">EEMS</h1>

          <p className="text-sm text-muted-foreground">
            Employee Management System
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="identifier" className="text-sm font-medium">
              Username / Email / Employee ID
            </label>

            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="EMP0001"
              autoComplete="username"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
