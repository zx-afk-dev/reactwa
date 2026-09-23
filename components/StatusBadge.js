export default function StatusBadge({ online, label }) {
  return (
    <div className="status-badge">
      <span className={`dot ${online ? 'dot-online' : 'dot-offline'}`} />
      {label}
    </div>
  );
}
