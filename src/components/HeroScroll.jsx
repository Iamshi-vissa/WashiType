import { useEffect, useState } from 'react';
import StrokeText from './reactbits/StrokeText.jsx';
import Hanko from './Hanko.jsx';

// A hanging sheet of washi: 和紙 ("washi") is brushed in one stroke at a time,
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
    wipeFrom: 'top',
    fontSize: 220,
    fontWeight: 400,
    fontFamily: '"Yuji Boku", "Shippori Mincho", serif',
    letterSpacing: 0
  };

  return (
    <figure className="scroll-art">
      <div className="scroll-sheet" aria-hidden="true">
        <span className="scroll-side" lang="ja">
          和紙タイプ　文字を探す
        </span>
        <div className="scroll-chars">
          <StrokeText text="和" {...brush} />
          {step >= 1 ? <StrokeText text="紙" {...brush} /> : <span className="scroll-blank" />}
        </div>
        {step >= 2 && <Hanko text="文字" size={52} stamp className="scroll-seal" />}
      </div>
      <figcaption>
        <span lang="ja">和紙</span> <em>washi</em>: handmade Japanese paper. The seal reads <span lang="ja">文字</span>,
        “letters”.
      </figcaption>
    </figure>
  );
}
