export default function CoinDisplay({ coin }) {
  return <div className="coin-badge">🪙 {coin ?? '—'}</div>;
}
