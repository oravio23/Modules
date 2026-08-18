import * as React from "react";
import { animate, useMotionValue, useTransform } from "framer-motion";
import { useMotionSafe } from "./motion";

export interface AnimatedNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  duration?: number;
}

/** Count-up for the portal's stat strip (module counts, etc). Renders the final value immediately with reduced motion. */
function AnimatedNumber({ value, duration = 0.8, ...props }: AnimatedNumberProps) {
  const motionSafe = useMotionSafe();
  const count = useMotionValue(motionSafe ? 0 : value);
  const rounded = useTransform(count, (v) => Math.round(v).toString());
  const [display, setDisplay] = React.useState(() => rounded.get());

  React.useEffect(() => {
    if (!motionSafe) {
      setDisplay(String(value));
      return;
    }
    const controls = animate(count, value, { duration, ease: "easeOut" });
    const unsubscribe = rounded.on("change", (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- count/rounded are stable MotionValues, not reactive deps
  }, [value, motionSafe, duration]);

  return <span {...props}>{display}</span>;
}

export { AnimatedNumber };
