export default function EmojiPicker({ emojis, selected, onToggle, disabled }) {
  return (
    <div className="emoji-grid">
      {emojis.map((e) => {
        const active = selected.includes(e);
        return (
          <button
            type="button"
            key={e}
            className={`emoji-btn ${active ? 'active' : ''}`}
            onClick={() => onToggle(e)}
            disabled={disabled}
            aria-pressed={active}
          >
            {e}
          </button>
        );
      })}
    </div>
  );
}
