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
    <nav aria-label="Main navigation" className="bg-white border-b-2 border-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <Link href="/" className="text-xl font-bold text-primary-500 tracking-wider">
            PURRSONA
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-neutral-700 hover:text-primary-500 font-bold"
                >
                  DASHBOARD
                </Link>
                <span className="text-sm text-neutral-500 font-bold">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-neutral-500 hover:text-error-main font-bold"
                >
                  LOGOUT
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm text-neutral-700 hover:text-primary-500 font-bold"
                >
                  LOGIN
                </Link>
                <Link
                  href="/auth/register"
                  className="text-sm bg-secondary-400 text-neutral-900 px-4 py-1.5 border-2 border-neutral-900 shadow-press-sm hover:shadow-press-md hover:-translate-x-0.5 hover:-translate-y-0.5 font-bold"
                >
                  REGISTER
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
