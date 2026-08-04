import React, { useEffect, useState } from "react";

export interface TypedSegment {
  /** Literal text, spacing included — the caller owns the spaces. */
  text: string;
  /** Token class for this run, e.g. "text-red". Omit for the inherited ink. */
  className?: string;
}

interface TypedHeadlineProps {
  segments: TypedSegment[];
  /** Milliseconds per character. Typewriter-fast by default, not a slow reveal. */
  speedMs?: number;
  className?: string;
}

// One headline, typed out. Both feed tabs render this — the copy and the colour
// split differ, the animation does not, so the logic lives here once.
//
// Replay is the caller's job, and it is a `key`, not a prop: mounting a fresh
// instance per tab resets the counter and the timer together, which no
// "restart" effect can do without racing the interval it is trying to cancel.
export const TypedHeadline: React.FC<TypedHeadlineProps> = ({
  segments,
  speedMs = 38,
  className,
}) => {
  const full = segments.map((s) => s.text).join("");

  // Read the motion preference during the first render rather than in an
  // effect: an effect would let one frame of empty headline through before
  // filling it in, which is the flash the preference exists to prevent.
  const [typed, setTyped] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? full.length
      : 0,
  );

  const done = typed >= full.length;

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => {
      setTyped((n) => {
        if (n >= full.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, speedMs);
    return () => window.clearInterval(id);
  }, [done, full.length, speedMs]);

  // Walk the segments and hand each one its own slice of the cursor, so the
  // colour boundaries stay put no matter where the typing has reached.
  // `upTo` is the character count revealed; the ghost layer passes the full
  // length to draw the finished headline.
  const renderRuns = (upTo: number) => {
    let consumed = 0;
    return segments.map((segment, i) => {
      const start = consumed;
      consumed += segment.text.length;
      const visible = segment.text.slice(
        0,
        Math.max(0, Math.min(segment.text.length, upTo - start)),
      );
      // Empty runs still render: dropping them would collapse the trailing
      // space a finished run needs before the next one starts typing.
      return (
        <span key={i} className={segment.className}>
          {visible}
        </span>
      );
    });
  };

  // Two layers, because a headline that grows as it types reflows everything
  // under it and then jumps back when it settles. The ghost is the finished
  // text, invisible but laid out — it owns the box, including how many lines
  // the copy wraps to. The typed text is absolutely positioned on top of it and
  // therefore contributes no size at all, so the feed below never moves.
  //
  // The ghost is also the accessible copy: it is the stable, complete string,
  // while the animating layer is hidden from assistive tech to keep a partial
  // word from being announced.
  return (
    <span className={`relative block ${className ?? ""}`}>
      <span className="invisible">{renderRuns(full.length)}</span>
      <span aria-hidden="true" className="absolute inset-0">
        {renderRuns(typed)}
      </span>
    </span>
  );
};
