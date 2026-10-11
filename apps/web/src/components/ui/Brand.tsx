export function Brand({ small = false }: { small?: boolean }) {
  return (
    <a className={`brand ${small ? 'brand-small' : ''}`} href="/" aria-label="SyncSpace home">
      <span className="brand-mark">
        <svg viewBox="0 0 40 40" fill="none">
          <path
            d="M12 16h10a6 6 0 0 1 0 12h-2M28 24H18a6 6 0 0 1 0-12h2"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span>
        Sync<span className="brand-light">Space</span>
        <span className="brand-dot">.</span>
      </span>
    </a>
  );
}
