/*
From Uiverse.io by Praashoo7 - https://uiverse.io/Praashoo7/fat-horse-65
MIT License, Copyright (c) Praashoo7 (Prashant)
*/
// A retro TV showing an error. Purely decorative (aria-hidden): the page around it says
// what went wrong in words. `screenText` is what the TV shows, `digits` the three big
// characters behind it.
import { useEffect } from 'react';
import './TvError.css';

const MONTSERRAT = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap';

export default function TvError({ screenText = 'NOT FOUND', digits = '404', size }) {
  // The TV's lettering is Montserrat, as in the original. Load it once, only when a TV is shown.
  useEffect(() => {
    if (document.querySelector(`link[href="${MONTSERRAT}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MONTSERRAT;
    document.head.appendChild(link);
  }, []);

  const [d1, d2, d3] = [...String(digits).padEnd(3).slice(0, 3)];

  return (
    <div className="tv404" aria-hidden="true" style={size ? { '--tv-size': size } : undefined}>
      <div className="tv404-main_wrapper">
        <div className="tv404-main">
          <div className="tv404-antenna">
            <div className="tv404-antenna_shadow"></div>
            <div className="tv404-a1"></div>
            <div className="tv404-a1d"></div>
            <div className="tv404-a2"></div>
            <div className="tv404-a2d"></div>
            <div className="tv404-a_base"></div>
          </div>
          <div className="tv404-tv">
            <div className="tv404-cruve">
              <svg
                className="tv404-curve_svg"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 189.929 189.929"
                xmlSpace="preserve"
              >
                <path
                  d="M70.343,70.343c-30.554,30.553-44.806,72.7-39.102,115.635l-29.738,3.951C-5.442,137.659,11.917,86.34,49.129,49.13
        C86.34,11.918,137.664-5.445,189.928,1.502l-3.95,29.738C143.041,25.54,100.895,39.789,70.343,70.343z"
                ></path>
              </svg>
            </div>
            <div className="tv404-display_div">
              <div className="tv404-screen_out">
                <div className="tv404-screen_out1">
                  <div className="tv404-screen">
                    <span className="tv404-notfound_text"> {screenText}</span>
                  </div>
                  <div className="tv404-screenM">
                    <span className="tv404-notfound_text"> {screenText}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="tv404-lines">
              <div className="tv404-line1"></div>
              <div className="tv404-line2"></div>
              <div className="tv404-line3"></div>
            </div>
            <div className="tv404-buttons_div">
              <div className="tv404-b1">
                <div></div>
              </div>
              <div className="tv404-b2"></div>
              <div className="tv404-speakers">
                <div className="tv404-g1">
                  <div className="tv404-g11"></div>
                  <div className="tv404-g12"></div>
                  <div className="tv404-g13"></div>
                </div>
                <div className="tv404-g"></div>
                <div className="tv404-g"></div>
              </div>
            </div>
          </div>
          <div className="tv404-bottom">
            <div className="tv404-base1"></div>
            <div className="tv404-base2"></div>
            <div className="tv404-base3"></div>
          </div>
        </div>
        <div className="tv404-text_404">
          <div className="tv404-text_4041">{d1}</div>
          <div className="tv404-text_4042">{d2}</div>
          <div className="tv404-text_4043">{d3}</div>
        </div>
      </div>
    </div>
  );
}
