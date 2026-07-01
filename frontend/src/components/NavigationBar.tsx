"use client";

import Link from "next/link";
import { useAuthContext } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export function NavigationBar() {
  const { user, logout } = useAuthContext();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  return (
    <nav className="bg-white shadow-sm border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <Link href="/" className="text-lg font-bold text-primary-600">
            Purrsona
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-neutral-600 hover:text-neutral-900"
                >
                  Dashboard
                </Link>
                <span className="text-sm text-neutral-500">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-neutral-500 hover:text-neutral-700"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm text-neutral-600 hover:text-neutral-900"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="text-sm bg-primary-500 text-white px-3 py-1.5 rounded-md hover:bg-primary-600"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
