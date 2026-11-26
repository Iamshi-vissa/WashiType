// A red seal (hanko) like the ones stamped on calligraphy. Two letters stack vertically.
// Pass children instead of text for a drawn mark.
export default function Hanko({ text = '', size = 36, on = true, stamp = false, className = '', children }) {
  const chars = [...text];
  return (
    <span
      className={`hanko${on ? ' is-on' : ''}${stamp ? ' stamp' : ''}${chars.length > 1 ? ' two' : ''} ${className}`}
      style={{ '--s': `${size}px` }}
      aria-hidden="true"
    >
      {children ?? chars.map((c, i) => <span key={i}>{c}</span>)}
    </span>
  );
}

// A brushed tick, used inside the seal that saves a font.
export function SaveMark() {
  return (
    <svg viewBox="0 0 24 24" className="hanko-mark">
      <path d="M5 12.5c1.6 1 3 2.6 4.2 4.6C11.6 12 14.6 8.2 19 5.5" />
    </svg>
  );
}
