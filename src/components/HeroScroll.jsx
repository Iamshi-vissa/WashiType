import { useEffect, useState } from 'react';
import StrokeText from './reactbits/StrokeText.jsx';
import Hanko from './Hanko.jsx';

// A hanging sheet of washi: the name is brushed one word at a time,
// then the red seal is stamped beside it.
export default function HeroScroll() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return setStep(3);
    const timers = [setTimeout(() => setStep(1), 1500), setTimeout(() => setStep(2), 3000), setTimeout(() => setStep(3), 3300)];
    return () => timers.forEach(clearTimeout);
  }, []);

  const brush = {
    strokeColor: 'currentColor',
    fillColor: 'currentColor',
    strokeWidth: 2.4,
    drawDuration: 1.3,
    fillDelay: 0,
    fillMode: 'wipe',
    wipeFrom: 'left',
    fontSize: 200,
    fontWeight: 400,
    fontFamily: '"Yuji Boku", "Shippori Mincho", serif',
    letterSpacing: 0
  };

  return (
    <figure className="scroll-art">
      <div className="scroll-sheet" aria-hidden="true">
        <span className="scroll-side">fonts on paper, written in ink</span>
        <div className="scroll-chars">
          <StrokeText text="Washi" {...brush} />
          {step >= 1 ? <StrokeText text="Type" {...brush} /> : <span className="scroll-blank" />}
        </div>
        {step >= 2 && <Hanko text="WT" size={52} stamp className="scroll-seal" />}
      </div>
      <figcaption>
        <em>Washi</em> is handmade Japanese paper, the kind calligraphers write on.
      </figcaption>
    </figure>
  );
}
