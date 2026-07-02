"use client";

import { useRef } from "react";

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  preview: string | null;
}

export function ImageUpload({ onImageSelect, preview }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImageSelect(file);
  };

  return (
    <div className="flex flex-col gap-4">
      {preview ? (
        <img
          src={preview}
          alt="Preview"
          className="max-w-full h-64 object-contain border-2 border-neutral-900"
        />
      ) : (
        <div
          className="w-full h-64 border-2 border-dashed border-neutral-900 flex items-center justify-center cursor-pointer bg-neutral-100"
          onClick={() => inputRef.current?.click()}
        >
          <span className="text-neutral-500 text-lg">Click to upload photo</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />
      {preview && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-primary-500 underline text-sm"
        >
          Change photo
        </button>
      )}
    </div>
  );
}
