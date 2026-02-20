import { useEffect, useRef, useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';

interface AnimatedLogoProps {
  size?: number;
}

export function AnimatedLogo({ size = 80 }: AnimatedLogoProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [showFill, setShowFill] = useState(false);
  const [drawStroke, setDrawStroke] = useState(false);
  const theme = useThemeStore((s) => s.theme);

  const strokeColor = theme === 'sepia' ? '#5C3D2E' : theme === 'lightPro' ? '#000000' : '#FFFFFF';

  useEffect(() => {
    // Show the fill shape after 2 seconds
    const fillTimer = setTimeout(() => {
      setShowFill(true);
    }, 500);

    // Start drawing the stroke 2.4s after load (slight delay after fill fades in)
    const strokeTimer = setTimeout(() => {
      setDrawStroke(true);
    }, 900);

    return () => {
      clearTimeout(fillTimer);
      clearTimeout(strokeTimer);
    };
  }, []);

  useEffect(() => {
    if (drawStroke && pathRef.current) {
      const length = pathRef.current.getTotalLength();
      pathRef.current.style.strokeDasharray = `${length}`;
      pathRef.current.style.strokeDashoffset = `${length}`;
      // Trigger reflow then animate
      pathRef.current.getBoundingClientRect();
      pathRef.current.style.transition = 'stroke-dashoffset 4s ease-in-out';
      pathRef.current.style.strokeDashoffset = '0';
    }
  }, [drawStroke]);

  return (
    <svg
      viewBox="560 280 520 520"
      width={size}
      height={size * (520 / 520)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        <path
          d="M702.1,345.9c25.2-7.7,52.1-10.6,78-11.6c56.2-2.2,114,9,163.5,36.1c91.2,49.9,153.5,171.9,96.8,269.8
            c-5.8,10-12.6,19.3-20.3,28c-51.4,57.7-137.3,79.5-212.1,77.7c-53.6-1.3-107.3-20.9-148.2-55.7c-45.3-38.4-69.4-94.6-71.4-153.7
            c-0.8-22,0.3-44.4,3.6-66.2c6-39.2,27.5-75.2,59.2-99.1C666.4,359.6,683.8,351.5,702.1,345.9z"
          fill="#3cf281"
          style={{
            opacity: showFill ? 1 : 0,
            transition: 'opacity 0.6s ease-in',
          }}
        />
        <path
          ref={pathRef}
          d="M777.7,769.8c0.1,0,0.3,0,0.3-0.2c4-11.2,8.4-26.5,9.1-36.8c1.4-20.6-3.8-40.8-6.8-61.1
            c-3.2-21-2.7-42.3-4-63.4c-1.3-23-11.8-35.1-43.8-47.4c-32-12.3-63.6-20.4-68.9-52.5c-5.3-32.1,8.2-57.8-9.1-84.1
            c-2.3-1.5,77.3,1.9,103.4,46.1c15.2,24.5,14.1,85.9,11.6,90.4c-1.6,2.9-37.7-71.2-81.7-106.7c-3.5-3.5,35.9,14.5,59.5,59.1
            c12.3,23.2,17.5,38,22.2,47.6c4.3,8.8,6.2,13,7.5,14.4c2.6,2.9,7.4-2.6,3.8-18.4c-3.5-15.8-0.9-45,3.1-58.6
            c4-13.6,6.3,54.1,6.5,56.7c0.1,2.6,8.1-2.5,10.6-23.3c2.5-20.8,9.2-70,61.7-100.9s128-16.5,132-16.1c1.2,0.1-3,3-3.3,3.3
            c-4.8,3.6-9.5,7.4-13.9,11.6c-20,19-30.4,45-47.8,66c-15.4,18.6-34.8,34.1-56.7,44.5c-20.1,9.5-42.5,14.5-64.8,12.9
            c-0.5,0-0.8-0.3-1-0.6c-0.9-2.3,6.9-27.3,33.7-59.6c21.9-26.4,65.1-53.8,85.7-55c3.3,0.5-87.1,42.4-119.4,114.6
            c-1.2,2.6-2.3,5.2-3.3,7.9c-8.7,23.1-15,47.5-14.2,72.4c0.8,24.2,7,48.3,10.8,72.3c3.6,22.9,1.6,45.4-1.9,68c0,0.1,0.1,0.3,0.2,0.3
            c123.1,13.9,236.9-70.9,257.5-194.6c21.3-127.8-65.1-248.6-192.8-269.9c-127.8-21.3-248.6,65.1-269.9,192.9
            C572.8,626.3,654.8,744.6,777.7,769.8z"
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
          strokeMiterlimit="10"
          style={{
            opacity: drawStroke ? 1 : 0,
          }}
        />
      </g>
    </svg>
  );
}
