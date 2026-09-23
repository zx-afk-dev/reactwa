import { useEffect } from 'react';

export default function Toast({ type = 'info', text, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className={`toast toast-${type}`} onClick={onClose}>{text}</div>;
}
