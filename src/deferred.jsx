// The animated ReactBits pieces load right after the first paint instead of before it.
// motion (~160 KB) and gsap (~110 KB) were most of the first download; now the page paints
// with light stand-ins and the animated versions take over a moment later. Each stand-in
// looks and works like the real thing, so nothing breaks if a chunk is slow or fails.
import { lazy, Suspense } from 'react';

const motionPieces = () => import('./components/reactbits/motionPieces.js');

const LazyRotatingText = lazy(() => motionPieces().then(m => ({ default: m.RotatingText })));
const LazyCountUp = lazy(() => motionPieces().then(m => ({ default: m.CountUp })));
const LazySquishSwitch = lazy(() => motionPieces().then(m => ({ default: m.SquishSwitch })));
const LazyWarmTooltip = lazy(() => motionPieces().then(m => ({ default: m.WarmTooltip })));
const LazySwipeToast = lazy(() => motionPieces().then(m => ({ default: m.SwipeToast })));
const LazyFoldText = lazy(() => import('./components/reactbits/FoldText.jsx'));
const LazyHeroScroll = lazy(() => import('./components/HeroScroll.jsx'));

export function RotatingText(props) {
  return (
    <Suspense fallback={<span className={props.mainClassName}>{props.texts[0]}</span>}>
      <LazyRotatingText {...props} />
    </Suspense>
  );
}

export function CountUp(props) {
  return (
    <Suspense fallback={<span>{props.to.toLocaleString('en-US')}</span>}>
      <LazyCountUp {...props} />
    </Suspense>
  );
}

// Stand-in switch: a real checkbox with the switch role, same label and state.
export function SquishSwitch(props) {
  const fallback = (
    <label className={`squish squish-fallback ${props.className ?? ''}`}>
      <input type="checkbox" role="switch" checked={props.checked} onChange={e => props.onChange(e.target.checked)} />
      <span>{props.label}</span>
    </label>
  );
  return (
    <Suspense fallback={fallback}>
      <LazySquishSwitch {...props} />
    </Suspense>
  );
}

export function WarmTooltip(props) {
  return (
    <Suspense fallback={props.children}>
      <LazyWarmTooltip {...props} />
    </Suspense>
  );
}

export function SwipeToast(props) {
  return (
    <Suspense fallback={null}>
      <LazySwipeToast {...props} />
    </Suspense>
  );
}

// The title shows as plain text at once; the fold animation replaces it when it arrives.
export function FoldText(props) {
  return (
    <Suspense fallback={<span className="fold-fallback">{props.text}</span>}>
      <LazyFoldText {...props} />
    </Suspense>
  );
}

// The hero's hanging sheet appears blank, then the brush lettering starts.
export function HeroScroll() {
  return (
    <Suspense
      fallback={
        <figure className="scroll-art">
          <div className="scroll-sheet" aria-hidden="true" />
          <figcaption>
            <em>Washi</em> is handmade Japanese paper, the kind calligraphers write on.
          </figcaption>
        </figure>
      }
    >
      <LazyHeroScroll />
    </Suspense>
  );
}
