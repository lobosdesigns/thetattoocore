type ProfileAvatarProfile = {
  avatar_url?: string | null;
  display_name?: string | null;
};

const sizeClass = {
  sm: "size-8 text-xs",
  md: "size-10 text-xs",
  lg: "size-11 text-sm",
  xl: "size-24 text-2xl",
} as const;

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileAvatar({
  className = "",
  profile,
  size = "lg",
}: {
  className?: string;
  profile?: ProfileAvatarProfile | null;
  size?: keyof typeof sizeClass;
}) {
  const name = profile?.display_name || "TC";

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#171412] font-bold text-[#c8953b] ${sizeClass[size]} ${className}`}
    >
      {profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="size-full object-cover" src={profile.avatar_url} />
      ) : (
        initials(name)
      )}
    </div>
  );
}
