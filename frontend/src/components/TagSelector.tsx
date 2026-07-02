"use client";

const CONDITION_TAGS = [
  "healthy", "friendly", "skittish", "injured", "hiding", "eating", "other",
];

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function TagSelector({ selectedTags, onChange }: TagSelectorProps) {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {CONDITION_TAGS.map((tag) => (
        <label
          key={tag}
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selectedTags.includes(tag)}
            onChange={() => toggleTag(tag)}
            className="w-5 h-5 border-2 border-neutral-900 accent-primary-500"
          />
          <span className="text-base capitalize">{tag}</span>
        </label>
      ))}
    </div>
  );
}
