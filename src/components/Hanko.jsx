// A red seal (hanko) like the ones stamped on calligraphy. Two characters stack vertically.
export default function Hanko({ text = '保', size = 36, on = true, stamp = false, className = '' }) {
  const chars = [...text];
  return (
    <span
      className={`hanko${on ? ' is-on' : ''}${stamp ? ' stamp' : ''}${chars.length > 1 ? ' two' : ''} ${className}`}
      style={{ '--s': `${size}px` }}
      aria-hidden="true"
    >
      {chars.map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </span>
  );
}
