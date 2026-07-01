"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { Card } from "@/components/Card";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          Login to Purrsona
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-error-light text-error-dark rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />

          <TextInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min 8 characters"
          />

          <Button type="submit" loading={loading} className="w-full">
            Login
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="text-primary-600 hover:underline"
          >
            Register
          </Link>
        </p>

        <div className="mt-6 p-3 bg-neutral-100 rounded-md text-xs text-neutral-500">
          <p className="font-semibold mb-1">
            Test accounts (password: password123)
          </p>
          <p>admin@purrsona.local — verified role</p>
          <p>user@purrsona.local — signed_in role</p>
        </div>
      </Card>
    </div>
  );
}
