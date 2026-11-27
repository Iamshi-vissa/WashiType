/*
From Uiverse.io by m1her - https://uiverse.io/m1her/odd-fireant-56
MIT License, Copyright (c) m1her (Maher Nas)
*/
// A chunky rocker switch: the rocker flips and the panel darkens when it's switched on.
// Ported from HTML + Tailwind to React and plain CSS (see OnOffSwitch.css for the changes).
import { useId } from 'react';
import './OnOffSwitch.css';

/**
 * @param checked   whether the switch is on
 * @param onChange  called with the new value
 * @param label     what the switch does, for screen readers and the hover tooltip
 * @param scale     size relative to the original (192 × 108 px); 1 is the original size.
 *                  Leave it out to set --onoff-scale from CSS instead (e.g. per screen size).
 */
export default function OnOffSwitch({ checked, onChange, label, scale, className = '' }) {
  const id = useId();
  return (
    <div className={`onoff ${className}`.trim()} style={scale === undefined ? undefined : { '--onoff-scale': scale }} title={label}>
      <div className="onoff-card">
        <div className="onoff-row">
          <span className="onoff-ring" aria-hidden="true" />
          <label htmlFor={id} className="onoff-rocker">
            <input
              type="checkbox"
              role="switch"
              id={id}
              className="onoff-input"
              checked={checked}
              aria-label={label}
              onChange={e => onChange(e.target.checked)}
            />
            <span className="onoff-face" aria-hidden="true">
              <span className="onoff-cap">
                <span className="onoff-cap-light" />
              </span>
              <span className="onoff-side onoff-side--left" />
              <span className="onoff-side onoff-side--right" />
            </span>
          </label>
          <span className="onoff-bar" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
