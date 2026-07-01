"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { Card } from "@/components/Card";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await register(email, password);
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
          CREATE PLAYER
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

          <TextInput
            label="CONFIRM PASSWORD"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Repeat password"
          />

          <Button type="submit" loading={loading} className="w-full">
            CREATE ACCOUNT
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-600">
          Already a player?{" "}
          <Link href="/auth/login" className="text-primary-500 font-bold hover:underline">
            LOGIN
          </Link>
        </p>
      </Card>
    </div>
  );
}
