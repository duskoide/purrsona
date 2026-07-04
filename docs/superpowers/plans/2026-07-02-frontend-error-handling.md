# Frontend Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add React ErrorBoundary for catching render errors and toast notifications for API error messages.

**Architecture:** ErrorBoundary wraps the app in layout.tsx to catch unhandled render errors. Toast system uses React context for showing notifications from anywhere in the app.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/ErrorBoundary.tsx` | Create | React error boundary |
| `frontend/src/components/Toast.tsx` | Create | Toast notification + provider |
| `frontend/src/app/layout.tsx` | Modify | Wrap with ErrorBoundary + ToastProvider |

---

### Task 1: ErrorBoundary Component

**Files:**
- Create: `frontend/src/components/ErrorBoundary.tsx`

- [ ] **Step 1: Create ErrorBoundary component**

```typescript
// frontend/src/components/ErrorBoundary.tsx
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-0 p-8">
          <div className="max-w-md text-center border-2 border-neutral-900 p-8 shadow-[6px_6px_0_#272220]">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-neutral-600 mb-6">
              An unexpected error occurred. Please try reloading the page.
            </p>
            <button
              onClick={this.handleReload}
              className="px-6 py-2 bg-primary-500 text-white border-2 border-neutral-900 rounded-full shadow-[3px_3px_0_#272220] hover:shadow-[1px_1px_0_#272220] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ErrorBoundary.tsx
git commit -m "feat: add ErrorBoundary component"
```

---

### Task 2: Toast System

**Files:**
- Create: `frontend/src/components/Toast.tsx`

- [ ] **Step 1: Create Toast component and provider**

```typescript
// frontend/src/components/Toast.tsx
"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "error" | "success" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 border-2 border-neutral-900 shadow-[3px_3px_0_#272220] max-w-sm ${
              toast.type === "error"
                ? "bg-error-light text-error-main"
                : toast.type === "success"
                ? "bg-success-light text-success-main"
                : "bg-neutral-100 text-neutral-900"
            }`}
          >
            <div className="flex justify-between items-start gap-3">
              <p className="text-base">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-neutral-500 hover:text-neutral-900"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Toast.tsx
git commit -m "feat: add Toast notification system"
```

---

### Task 3: Wrap App with ErrorBoundary and ToastProvider

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Add ErrorBoundary and ToastProvider to layout**

Read `frontend/src/app/layout.tsx`. Wrap the children with ErrorBoundary and ToastProvider:

```typescript
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
```

In the JSX:
```tsx
<AuthProvider>
  <ErrorBoundary>
    <ToastProvider>
      <NavigationBar />
      {children}
    </ToastProvider>
  </ErrorBoundary>
</AuthProvider>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat: wrap app with ErrorBoundary and ToastProvider"
```
