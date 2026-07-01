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
      <Card rainbow className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-primary-500">
          PLAYER LOGIN
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-error-light text-error-main border-2 border-error-main text-sm font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            label="EMAIL"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="player@purrsona.local"
          />

          <TextInput
            label="PASSWORD"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min 8 characters"
          />

          <Button type="submit" loading={loading} className="w-full">
            START GAME
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-600">
          No account?{" "}
          <Link
            href="/auth/register"
            className="text-primary-500 font-bold hover:underline"
          >
            CREATE PLAYER
          </Link>
        </p>

        <div className="mt-6 p-3 bg-secondary-400 border-2 border-neutral-900 text-xs text-neutral-900 font-bold">
          <p className="mb-1">TEST ACCOUNTS (password: password123)</p>
          <p>admin@purrsona.local — VERIFIED</p>
          <p>user@purrsona.local — SIGNED IN</p>
        </div>
      </Card>
    </div>
  );
}
