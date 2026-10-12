export function Brand({ small = false }: { small?: boolean }) {
  return (
    <a className={`brand ${small ? 'brand-small' : ''}`} href="/" aria-label="CatSketch home">
      <span className="brand-mark">
        <svg viewBox="0 0 40 40" fill="none">
          <path
            d="m11 17-1-7 8 5h4l8-5-1 7q5 5 1 11-3 5-10 5t-10-5q-4-6 1-11M15 22h1m8 0h1m-7 5q2 2 4 0"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span>
        Cat<span className="brand-light">Sketch</span>
        <span className="brand-dot">.</span>
      </span>
    </a>
  );
}
