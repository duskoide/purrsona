"use client";

import { useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me", { credentials: "include" });
      if (res.ok) {
        setUser(await res.json());
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Login failed");
    }
    await fetchUser();
  };

  const register = async (email: string, password: string) => {
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Registration failed");
    }
    await fetchUser();
  };

  const logout = async () => {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  const updateEmail = async (email: string, currentPassword: string) => {
    const res = await fetch("/api/v1/auth/me/email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, current_password: currentPassword }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Failed to update email");
    }
    const updated = await res.json();
    setUser(updated);
  };

  const uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/v1/auth/me/avatar", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Failed to upload photo");
    }
    const updated = await res.json();
    setUser(updated);
  };

  const deleteAccount = async (currentPassword: string) => {
    const res = await fetch("/api/v1/auth/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ current_password: currentPassword }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Failed to delete account");
    }
    setUser(null);
  };

  return {
    user,
    isLoading,
    login,
    register,
    logout,
    updateEmail,
    uploadAvatar,
    deleteAccount,
  };
}
