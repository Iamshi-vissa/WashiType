import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

// A dropdown that always opens downwards (the browser's own <select> flips upwards
// when it sits low on the screen). If there isn't room below, the page scrolls the
// control up first. Keyboard: arrows, Home/End, Enter/Space, Escape, type to jump.
export default function Select({ label, value, options, onChange }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [maxHeight, setMaxHeight] = useState(340);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ text: '', timer: 0 });

  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));
  const selected = options[selectedIndex];

  const openMenu = () => {
    const rect = buttonRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    if (below < 260) {
      // Bring the control near the top so the menu has room to drop down.
      window.scrollBy({ top: rect.top - 90, behavior: 'instant' });
    }
    setActive(selectedIndex);
    setOpen(true);
  };

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };

  const choose = index => {
    onChange(options[index].value);
    close();
  };

  // Fit the menu to the space below the control.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMaxHeight(Math.max(160, Math.min(340, window.innerHeight - rect.bottom - 16)));
    listRef.current?.focus();
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  // Close on a click outside (without moving focus back to the button).
  useEffect(() => {
    if (!open) return;
    const onDown = e => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onButtonKey = e => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      openMenu();
    }
  };

  const onListKey = e => {
    const last = options.length - 1;
    const keys = {
      ArrowDown: () => setActive(i => Math.min(last, i + 1)),
      ArrowUp: () => setActive(i => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      PageDown: () => setActive(i => Math.min(last, i + 8)),
      PageUp: () => setActive(i => Math.max(0, i - 8)),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => close(),
      Tab: () => close(false)
    };
    if (keys[e.key]) {
      if (e.key !== 'Tab') e.preventDefault();
      keys[e.key]();
      return;
    }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      const t = typed.current;
      clearTimeout(t.timer);
      t.text += e.key.toLowerCase();
      t.timer = setTimeout(() => (t.text = ''), 600);
      const match = options.findIndex(o => o.label.toLowerCase().startsWith(t.text));
      if (match >= 0) setActive(match);
    }
  };

  return (
    <div className={`select${open ? ' is-open' : ''}`} ref={rootRef}>
      <span className="select-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        className="select-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onButtonKey}
      >
        <span id={`${id}-value`}>{selected?.label}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          className="select-menu"
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-opt-${active}`}
          style={{ maxHeight }}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              className={`${i === active ? 'is-active' : ''}${o.value === value ? ' is-selected' : ''}`}
              onPointerMove={() => setActive(i)}
              onClick={() => choose(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
