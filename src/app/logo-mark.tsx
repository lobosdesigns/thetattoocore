export function LogoMark({ className = "size-10" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 144 188"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M72 0c21 14 43 19 72 21v77c0 36-28 66-72 90C28 164 0 134 0 98V21C29 19 51 14 72 0Z"
        fill="#171412"
      />
      <path
        d="M72 12c18 11 38 16 61 18v67c0 29-23 54-61 76-38-22-61-47-61-76V30c23-2 43-7 61-18Z"
        stroke="#C8953B"
        strokeWidth="4"
      />
      <text
        fill="#FFFDF9"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="58"
        fontWeight="900"
        textAnchor="middle"
        x="55"
        y="80"
      >
        T
      </text>
      <text
        fill="#F3C15F"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="58"
        fontWeight="900"
        textAnchor="middle"
        x="96"
        y="103"
      >
        T
      </text>
      <text
        fill="#FFFDF9"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="64"
        fontWeight="900"
        textAnchor="middle"
        x="69"
        y="151"
      >
        C
      </text>
    </svg>
  );
}

export function LogoWordmark({
  className = "h-28 w-24",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-label="The Tattoo Core"
      className={className}
      fill="none"
      role="img"
      viewBox="0 0 350 455"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M175 0C226 33 280 45 350 49V238C350 326 281 398 175 455C69 398 0 326 0 238V49C70 45 124 33 175 0Z"
        fill="#171412"
      />
      <path
        d="M175 23C218 50 267 62 325 67V235C325 307 268 368 175 421C82 368 25 307 25 235V67C83 62 132 50 175 23Z"
        stroke="#C8953B"
        strokeWidth="8"
      />
      <text
        fill="#FFFDF9"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="48"
        fontWeight="700"
        textAnchor="middle"
        x="175"
        y="134"
      >
        The
      </text>
      <text
        fill="#F3C15F"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="70"
        fontWeight="900"
        textAnchor="middle"
        x="175"
        y="214"
      >
        Tattoo
      </text>
      <text
        fill="#FFFDF9"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="64"
        fontWeight="900"
        textAnchor="middle"
        x="175"
        y="292"
      >
        Core
      </text>
      <path
        d="M93 328H257"
        stroke="#C8953B"
        strokeLinecap="round"
        strokeWidth="5"
      />
      <text
        fill="#D8D1C6"
        fontFamily="Arial, sans-serif"
        fontSize="18"
        fontWeight="700"
        textAnchor="middle"
        x="175"
        y="366"
      >
        TATTOO COMMUNITY
      </text>
    </svg>
  );
}

export function LogoLockup({
  className = "h-16 w-56",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-label="The Tattoo Core"
      className={className}
      fill="none"
      role="img"
      viewBox="0 0 470 125"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        <path
          d="M48 0c14 9 29 13 48 14v51c0 24-19 44-48 60C19 109 0 89 0 65V14C19 13 34 9 48 0Z"
          fill="#171412"
        />
        <path
          d="M48 8c12 8 25 11 40 12v44c0 19-15 35-40 50C23 99 8 83 8 64V20c15-1 28-4 40-12Z"
          stroke="#C8953B"
          strokeWidth="3"
        />
        <text
          fill="#FFFDF9"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="39"
          fontWeight="900"
          textAnchor="middle"
          x="37"
          y="54"
        >
          T
        </text>
        <text
          fill="#F3C15F"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="39"
          fontWeight="900"
          textAnchor="middle"
          x="64"
          y="70"
        >
          T
        </text>
        <text
          fill="#FFFDF9"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="43"
          fontWeight="900"
          textAnchor="middle"
          x="46"
          y="102"
        >
          C
        </text>
      </g>
      <g transform="translate(122 21)">
        <text
          fill="currentColor"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="26"
          fontWeight="700"
          x="0"
          y="0"
        >
          The
        </text>
        <text
          fill="currentColor"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="48"
          fontWeight="900"
          x="0"
          y="42"
        >
          Tattoo Core
        </text>
        <text
          fill="color-mix(in srgb, currentColor 64%, transparent)"
          fontFamily="Arial, sans-serif"
          fontSize="16"
          fontWeight="600"
          x="0"
          y="72"
        >
          The heart of the tattoo community.
        </text>
      </g>
    </svg>
  );
}
