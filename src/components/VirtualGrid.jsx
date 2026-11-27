import { useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

const MIN_COLUMN = 290; // same as the CSS grid's minmax(290px, 1fr)
const COLUMN_GAP = 22;
const ROW_GAP = 28;

/**
 * A grid that only renders the rows near the screen, so 2,000+ sheets cost the same as a
 * screenful: fewer components, fewer font downloads, less memory. Rows are measured after
 * they render, so cards can be any height.
 */
export default function VirtualGrid({ items, getKey, renderItem, estimateRowHeight = 280 }) {
  const ref = useRef(null);
  const [columns, setColumns] = useState(3);
  const [offset, setOffset] = useState(0);

  // Columns follow the width; the offset (where the grid starts on the page) follows the
  // layout above it (hero, filters wrapping onto more lines, the offline bar...).
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      setColumns(Math.max(1, Math.floor((width + COLUMN_GAP) / (Math.min(MIN_COLUMN, width) + COLUMN_GAP))));
      setOffset(node.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    // Measure on the next frame, not inside the observer's callback: the new column count
    // changes the grid's height, which resizes the body this observer is watching, and
    // Safari reports that same-frame loop as an error ("ResizeObserver loop completed").
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(node);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const rows = Math.ceil(items.length / columns);
  const virtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => estimateRowHeight + ROW_GAP,
    overscan: 3,
    scrollMargin: offset,
    // Measure rows on the next frame too, for the same reason as above: a row's new height
    // moves the rows below it, which the same observer is watching.
    useAnimationFrameWithResizeObserver: true
  });

  return (
    <div ref={ref} className="vgrid" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map(row => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          className="vgrid-row"
          style={{
            transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            columnGap: COLUMN_GAP,
            paddingBottom: ROW_GAP
          }}
        >
          {items.slice(row.index * columns, row.index * columns + columns).map(item => (
            <div key={getKey(item)} className="vgrid-cell">
              {renderItem(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
