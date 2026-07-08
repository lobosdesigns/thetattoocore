export function LogoMark({ className = "size-10" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#171412" height="48" rx="8" width="48" />
      <path
        d="M24 35s-11-6.7-11-15.1c0-4 2.8-6.9 6.4-6.9 2.2 0 3.7 1 4.6 2.4.9-1.4 2.4-2.4 4.6-2.4 3.6 0 6.4 2.9 6.4 6.9C35 28.3 24 35 24 35Z"
        fill="#f3c15f"
      />
      <path
        d="M15 37 36.5 15.5"
        stroke="#fffdf9"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M33.5 12.5 39 18"
        stroke="#fffdf9"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M14.7 37.3 12.4 39.6"
        stroke="#c8953b"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}
