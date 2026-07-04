# Frontend Error Handling Design

Date: 2026-07-02
Status: Approved for implementation

## Summary

React ErrorBoundary for catching render errors and a toast notification system for API error messages.

## Scope

**In scope:**
- ErrorBoundary component wrapping the app
- Toast notification component
- ToastProvider context for showing toasts from anywhere
- Integration with existing pages (incremental)

**Out of scope:**
- Offline detection
- Retry logic
- External error logging service
- Server-side error handling

## ErrorBoundary

React class component that catches unhandled render errors.

- Wraps app in `layout.tsx`
- Fallback UI: "Something went wrong" message + "Reload" button
- Logs error to console
- Uses design system styling (VT323, 0px corners, hard shadows)

## Toast System

Lightweight notification component.

- `ToastProvider` wraps app in `layout.tsx`
- `useToast()` hook returns `showToast(message, type)` function
- Types: `error`, `success`, `info`
- Auto-dismisses after 5 seconds
- Positioned bottom-right
- Design system styling

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/components/ErrorBoundary.tsx` | Create — React error boundary |
| `frontend/src/components/Toast.tsx` | Create — toast notification + provider |
| `frontend/src/app/layout.tsx` | Modify — wrap with ErrorBoundary + ToastProvider |

## Design System Compliance

- VT323 font, 0px corners, hard shadows
- prefers-reduced-motion fallbacks
