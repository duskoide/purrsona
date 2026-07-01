"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/v1/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          router.push("/dashboard");
        } else {
          router.push("/auth/login");
        }
      })
      .catch(() => {
        router.push("/auth/login");
      });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-neutral-500">Redirecting...</p>
    </div>
  );
}
