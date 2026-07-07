"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/Button";
import { Card, CardTitle } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { TextInput } from "@/components/TextInput";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user, uploadAvatar, updateEmail, deleteAccount } = useAuthContext();
  const router = useRouter();

  // Account settings — profile picture
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  // Account settings — change email
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // Account settings — delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    setAvatarUploading(true);
    try {
      await uploadAvatar(file);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setEmailSuccess("");
    setEmailSubmitting(true);
    try {
      await updateEmail(newEmail, emailPassword);
      setEmailSuccess("Email updated!");
      setNewEmail("");
      setEmailPassword("");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to update email");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    setDeleteSubmitting(true);
    try {
      await deleteAccount(deletePassword);
      setShowDeleteModal(false);
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-primary-500">
          PLAYER DASHBOARD
        </h1>

        {/* Player profile - score card */}
        <Card variant="featured" className="mb-6">
          <CardTitle>YOUR PROFILE</CardTitle>
          <div className="space-y-2">
            <p className="font-bold">
              EMAIL: <span className="font-normal text-base">{user?.email}</span>
            </p>
            <p className="font-bold flex items-center gap-2">
              STATUS: <StatusBadge status={user?.role || "public"} />
            </p>
          </div>
        </Card>

        <Card className="mb-6">
          <CardTitle>ACCOUNT SETTINGS</CardTitle>

          {/* Profile picture */}
          <div className="pb-6 mb-6 border-b-2 border-neutral-200">
            <h3 className="font-bold mb-3">PROFILE PICTURE</h3>
            <div className="flex items-center gap-4">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={`${user.email}'s profile picture`}
                  className="w-20 h-20 object-cover border-2 border-neutral-900 shadow-[3px_3px_0_#272220]"
                />
              ) : (
                <div
                  className="w-20 h-20 flex items-center justify-center border-2 border-neutral-900
                    bg-neutral-100 text-neutral-500 font-bold text-xs text-center shadow-[3px_3px_0_#272220]"
                  aria-hidden="true"
                >
                  NO PHOTO
                </div>
              )}
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  loading={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {user?.avatar_url ? "Change photo" : "Upload photo"}
                </Button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                  aria-label="Upload profile picture"
                />
                {avatarError && (
                  <p className="mt-2 text-sm text-error-main font-bold" role="alert">
                    {avatarError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Change email */}
          <div className="pb-6 mb-6 border-b-2 border-neutral-200">
            <h3 className="font-bold mb-3">CHANGE EMAIL ADDRESS</h3>
            <form onSubmit={handleUpdateEmail} className="space-y-4 max-w-sm">
              <TextInput
                label="New email address"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
              <TextInput
                label="Current password"
                type="password"
                helper="Confirm your identity to change your email."
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                required
              />
              {emailError && (
                <p className="text-sm text-error-main font-bold" role="alert">
                  {emailError}
                </p>
              )}
              {emailSuccess && (
                <p className="text-sm text-success-main font-bold" role="status">
                  {emailSuccess}
                </p>
              )}
              <Button type="submit" size="sm" loading={emailSubmitting}>
                Update email
              </Button>
            </form>
          </div>

          {/* Delete account */}
          <div>
            <h3 className="font-bold mb-2 text-error-main">DELETE ACCOUNT</h3>
            <p className="text-sm text-neutral-500 mb-3">
              This permanently disables your account. Your sightings and TNR
              records stay on the map to help the community, but your login
              and profile are gone for good. This cannot be undone.
            </p>
            <Button
              variant="destructive"
              size="sm"
              type="button"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete my account
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>QUICK LINKS</CardTitle>
          <div className="space-y-2 text-sm">
            <p>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                className="text-primary-500 font-bold hover:underline
                  focus-visible:outline-3 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
              >
                API DOCS (SWAGGER)
              </a>
            </p>
            <p>
              <a
                href="http://localhost:8000/health"
                target="_blank"
                className="text-primary-500 font-bold hover:underline
                  focus-visible:outline-3 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
              >
                HEALTH CHECK
              </a>
            </p>
            <p>
              <a
                href="http://localhost:9001"
                target="_blank"
                className="text-primary-500 font-bold hover:underline
                  focus-visible:outline-3 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
              >
                MINIO CONSOLE (minioadmin/minioadmin)
              </a>
            </p>
          </div>
        </Card>

        {/* Delete account confirmation modal */}
        <Modal
          open={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeletePassword("");
            setDeleteError("");
          }}
          title="DELETE YOUR ACCOUNT?"
          destructive
        >
          <p className="text-sm text-neutral-600 mb-4">
            This is permanent. Your email and profile picture will be
            removed and you will be signed out immediately. Your sightings
            and TNR history stay visible to help the community.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDeleteAccount();
            }}
            className="space-y-4"
          >
            <TextInput
              label="Current password"
              type="password"
              helper="Enter your password to confirm deletion."
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
            />
            {deleteError && (
              <p className="text-sm text-error-main font-bold" role="alert">
                {deleteError}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword("");
                  setDeleteError("");
                }}
              >
                CANCEL
              </Button>
              <Button
                variant="destructive"
                size="sm"
                type="submit"
                loading={deleteSubmitting}
              >
                Delete my account
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
