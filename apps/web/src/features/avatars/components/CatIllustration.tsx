export function CatIllustration({
  className = '',
  variant = 'sketch',
}: {
  className?: string;
  variant?: 'sketch' | 'wave' | 'nap' | 'peek' | 'play';
}) {
  if (variant !== 'sketch')
    return (
      <svg
        className={`cat-mascot cat-${variant} ${className}`}
        viewBox="0 0 200 150"
        fill="none"
        role="img"
        aria-label={
          {
            wave: 'A black and white cat waving a paw',
            nap: 'A blue gray cat curled up asleep',
            peek: 'A cream cat peeking over a notebook',
            play: 'A playful lavender cat reaching for a star',
          }[variant]
        }
      >
        {variant === 'wave' ? (
          <WaveCat />
        ) : variant === 'nap' ? (
          <SleepingCat />
        ) : variant === 'peek' ? (
          <PeekingCat />
        ) : (
          <PlayfulCat />
        )}
      </svg>
    );
  return (
    <svg
      className={`cat-mascot ${className}`}
      viewBox="0 0 200 150"
      fill="none"
      aria-label="A curious cat sketching an idea"
      role="img"
    >
      <path
        d="M124 124q65 12 49-29-5-11-19-9"
        stroke="#d99a70"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <path d="M54 137q-12-61 30-62 51-2 51 62" fill="#f3c39b" stroke="#76584b" strokeWidth="2" />
      <path
        d="m51 50-3-31q0-6 6-2l24 18h25l24-18q6-4 5 3l-2 31q11 22-1 37-10 12-39 12T51 86q-10-14 0-36"
        fill="#f3c39b"
        stroke="#76584b"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="m54 39-2-17 17 14m40 0 18-14-1 17" fill="#df9a8a" />
      <path d="m83 39 7 10 7-10" stroke="#cf936d" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M67 66q5-6 10 0m27 0q5-6 10 0"
        stroke="#76584b"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="m86 72 5 5 5-5z" fill="#a46f64" />
      <path
        d="M91 77v6m-8 0q4 5 8 0 4 5 8 0M61 75l-20-4m20 10-20 3m80-9 20-4m-20 10 20 3"
        stroke="#76584b"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M67 99q23 9 46 0" stroke="#8fa37b" strokeWidth="10" strokeLinecap="round" />
      <path d="m113 105 5 24" stroke="#8fa37b" strokeWidth="10" strokeLinecap="round" />
      <path d="M45 132h94l-8 14H38z" fill="#fff9e9" stroke="#76584b" strokeWidth="1.5" />
      <path d="m105 118 18-35" stroke="#76584b" strokeWidth="7" strokeLinecap="round" />
      <path d="m124 82 4-9-8 6" fill="#76584b" />
      <ellipse cx="61" cy="127" rx="15" ry="10" fill="#f3c39b" stroke="#76584b" strokeWidth="1.5" />
      <ellipse cx="108" cy="124" rx="12" ry="9" fill="#f3c39b" stroke="#76584b" strokeWidth="1.5" />
      <path
        d="m20 36 3 6m-7-2 7-4m124 23 5 2m-2-5-1 6"
        stroke="#d79574"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WaveCat() {
  return (
    <>
      <path
        d="M119 138q64 10 49-24-8-12-22-1"
        stroke="#373940"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path d="M58 146q-7-69 33-69t34 69" fill="#373940" stroke="#c1a487" strokeWidth="2" />
      <path d="M75 96q16 13 33 0l-1 42H76z" fill="#fff7e8" />
      <path
        d="m57 43-1-29 22 17h28l23-16-2 29q14 17 2 35-11 15-35 15T57 77q-11-17 0-34"
        fill="#373940"
        stroke="#c1a487"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="m63 30-1-10 12 11m36 0 13-10-1 12" fill="#dca7a9" />
      <path d="M91 36q-13 24-20 24 0 23 22 23t24-23q-13-2-26-24" fill="#fff7e8" />
      <ellipse cx="72" cy="52" rx="4" ry="5" fill="#e0c48b" />
      <ellipse cx="110" cy="52" rx="4" ry="5" fill="#e0c48b" />
      <path d="m89 62 5 5 5-5z" fill="#d49694" />
      <path
        d="M94 67v6m-7-1q4 7 7 1 4 6 8-1M66 63l-18-4m18 10-17 2m67-8 17-4m-17 10 17 2"
        stroke="#6f5b52"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M68 101q-23 4-28-20l-7-30" stroke="#373940" strokeWidth="18" strokeLinecap="round" />
      <ellipse cx="32" cy="46" rx="14" ry="16" fill="#fff7e8" stroke="#b49b83" strokeWidth="1.5" />
      <ellipse cx="31" cy="49" rx="6" ry="7" fill="#dca7a9" />
      <circle cx="23" cy="38" r="3" fill="#dca7a9" />
      <circle cx="32" cy="35" r="3" fill="#dca7a9" />
      <circle cx="40" cy="39" r="3" fill="#dca7a9" />
      <path d="m75 91 9-8 10 7 10-7 9 8-9 9-10-7-10 7z" fill="#dbad60" />
      <path
        d="M138 27l4 7m-7-2 8-4m15 16 4 6"
        stroke="#dbad60"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="80" cy="141" rx="15" ry="7" fill="#fff7e8" />
      <ellipse cx="111" cy="141" rx="15" ry="7" fill="#fff7e8" />
    </>
  );
}
function SleepingCat() {
  return (
    <>
      <ellipse cx="102" cy="134" rx="78" ry="8" fill="#dfe4e6" />
      <path
        d="M48 123q-14-63 46-62 60-1 72 38 16 39-53 39H72q-22 0-24-15"
        fill="#9eabbc"
        stroke="#5d6b81"
        strokeWidth="2"
      />
      <path
        d="M112 85q37 11 43 29 8 19-31 19h-37"
        stroke="#5d6b81"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <path
        d="m42 81-6-25 22 9 23-4 14-21 5 31q11 27-7 39-25 16-45-2-14-11-6-27"
        fill="#bdc8d5"
        stroke="#5d6b81"
        strokeWidth="2"
      />
      <path d="m42 67 2-6 8 7m33-8 8-9 1 12" fill="#d6a4a9" />
      <path
        d="M51 85q5 5 10 0m13-6q5 5 10 0"
        stroke="#58677d"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="m63 92 4 3 4-5" fill="#b7838c" />
      <path
        d="m68 96 2 3m-17-1-14 1m43-12 13-5"
        stroke="#58677d"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <ellipse cx="65" cy="120" rx="18" ry="8" fill="#dce4ec" transform="rotate(-9 65 120)" />
      <path
        d="m102 38 10-2-7 13 11-2m16-26 16-2-13 20 17-2"
        stroke="#81949e"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
function PeekingCat() {
  return (
    <>
      <path
        d="m59 66-3-28 24 16h27l21-17-2 30q12 16 5 36-9 16-38 16T60 105q-13-14-1-39"
        fill="#f7ebcf"
        stroke="#8b7c6a"
        strokeWidth="2"
      />
      <path d="M61 62q7-8 21-12l-4 32q-12 4-19-9" fill="#c39569" />
      <path d="M109 52q15-7 19 16l-12 13-13-6z" fill="#9c9287" />
      <path d="m64 54-3-9 11 9m42 0 10-9-1 11" fill="#e0b5ae" />
      <ellipse cx="76" cy="78" rx="4" ry="6" fill="#687158" />
      <ellipse cx="109" cy="78" rx="4" ry="6" fill="#687158" />
      <path d="m89 87 5 4 5-4z" fill="#c29594" />
      <path
        d="M94 91v5m-7 0q3 5 7 0 4 5 7 0M67 91l-16-2m68 2 15-3"
        stroke="#8b7c6a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="30"
        y="108"
        width="143"
        height="34"
        rx="5"
        fill="#e0e6c9"
        stroke="#879772"
        strokeWidth="2"
      />
      <path d="M47 118h111m-111 10h71" stroke="#a4b18a" strokeWidth="1.5" />
      <ellipse cx="65" cy="108" rx="15" ry="9" fill="#f7ebcf" stroke="#8b7c6a" strokeWidth="1.5" />
      <ellipse cx="122" cy="108" rx="15" ry="9" fill="#f7ebcf" stroke="#8b7c6a" strokeWidth="1.5" />
      <path
        d="m57 108 1 4m5-5 1 5m55-5 1 5m6-5 1 4"
        stroke="#c7bca8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="m144 50 2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="#cfb46c" />
    </>
  );
}
function PlayfulCat() {
  return (
    <>
      <path
        d="M61 124q-34-3-30-34 3-13 17-10"
        stroke="#a19abd"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M65 135q-20-51 14-71 25-10 48 35l9 28"
        fill="#c8c1dd"
        stroke="#807794"
        strokeWidth="2"
      />
      <path
        d="m60 50 7-24 17 18 20 4 24-9-7 26q3 21-17 28-30 5-42-16-9-12-2-27"
        fill="#c8c1dd"
        stroke="#807794"
        strokeWidth="2"
      />
      <path d="m68 41 1-10 9 12m29 12 13-9-3 11" fill="#e1b3bd" />
      <path d="m75 66 6 3m21 1 6-3" stroke="#6c627e" strokeWidth="3" strokeLinecap="round" />
      <path d="m87 76 3 5 5-3z" fill="#b58497" />
      <path
        d="m90 81-2 6m-7-4q0 7 7 4 5 7 9 2"
        stroke="#6c627e"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M111 94q23-5 24-23l5-26" stroke="#c8c1dd" strokeWidth="15" strokeLinecap="round" />
      <ellipse cx="141" cy="42" rx="10" ry="12" fill="#e6e1f0" stroke="#807794" strokeWidth="1.5" />
      <path d="m82 91 16 11" stroke="#dda562" strokeWidth="7" strokeLinecap="round" />
      <path
        d="M90 109q12 14 14 32m-29-17-6 17"
        stroke="#e6e1f0"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path d="m150 19 4 10 11 1-9 7 3 11-9-6-9 6 3-11-9-7 11-1z" fill="#d8b065" />
      <path
        d="m168 62 6 2m-12 53 4 6m-136 3 5-3"
        stroke="#d8b065"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  );
}
