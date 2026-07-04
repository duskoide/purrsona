"use client";

import Link from "next/link";
import { useAuthContext } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";

export function NavigationBar() {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav aria-label="Main navigation" className="bg-white border-b-2 border-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <Link href="/" className="text-xl font-bold text-primary-500 tracking-wider
            focus-visible:outline-3 focus-visible:outline-secondary-400 focus-visible:outline-offset-2">
            PURRSONA
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/map"
              className={`text-sm font-bold px-3 py-1
                focus-visible:outline-3 focus-visible:outline-secondary-400 focus-visible:outline-offset-2
                ${isActive("/map")
                  ? "bg-primary-500 text-white border-2 border-neutral-900"
                  : "text-neutral-700 hover:text-primary-500"
                }`}
            >
              MAP
            </Link>
            <Link
              href="/cats"
              className={`text-sm font-bold px-3 py-1
                focus-visible:outline-3 focus-visible:outline-secondary-400 focus-visible:outline-offset-2
                ${isActive("/cats")
                  ? "bg-primary-500 text-white border-2 border-neutral-900"
                  : "text-neutral-700 hover:text-primary-500"
                }`}
            >
              CATS
            </Link>
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className={`text-sm font-bold px-3 py-1
                    focus-visible:outline-3 focus-visible:outline-secondary-400 focus-visible:outline-offset-2
                    ${isActive("/dashboard")
                      ? "bg-primary-500 text-white border-2 border-neutral-900"
                      : "text-neutral-700 hover:text-primary-500"
                    }`}
                >
                  DASHBOARD
                </Link>
                <Link
                  href="/sightings/new"
                  className={`text-sm font-bold px-3 py-1
                    focus-visible:outline-3 focus-visible:outline-secondary-400 focus-visible:outline-offset-2
                    ${isActive("/sightings/new")
                      ? "bg-primary-500 text-white border-2 border-neutral-900"
                      : "text-neutral-700 hover:text-primary-500"
                    }`}
                >
                  REPORT SIGHTING
                </Link>
                <Link
                  href="/feeding-spots/new"
                  className={`text-sm font-bold px-3 py-1
                    focus-visible:outline-3 focus-visible:outline-secondary-400 focus-visible:outline-offset-2
                    ${isActive("/feeding-spots/new")
                      ? "bg-primary-500 text-white border-2 border-neutral-900"
                      : "text-neutral-700 hover:text-primary-500"
                    }`}
                >
                  FEEDING SPOTS
                </Link>
                <span className="text-sm text-neutral-500 font-bold">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-neutral-500 hover:text-error-main font-bold
                    focus-visible:outline-3 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
                >
                  LOGOUT
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className={`text-sm font-bold px-3 py-1
                    focus-visible:outline-3 focus-visible:outline-secondary-400 focus-visible:outline-offset-2
                    ${isActive("/auth/login")
                      ? "bg-primary-500 text-white border-2 border-neutral-900"
                      : "text-neutral-700 hover:text-primary-500"
                    }`}
                >
                  LOGIN
                </Link>
                <Link
                  href="/auth/register"
                  className={`text-sm font-bold px-4 py-1.5 border-2 border-neutral-900
                    shadow-[3px_3px_0_#272220] hover:shadow-[6px_6px_0_#272220]
                    hover:-translate-x-0.5 hover:-translate-y-0.5
                    focus-visible:outline-3 focus-visible:outline-secondary-400 focus-visible:outline-offset-2
                    ${isActive("/auth/register")
                      ? "bg-secondary-400 text-neutral-900"
                      : "bg-secondary-400 text-neutral-900"
                    }`}
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
