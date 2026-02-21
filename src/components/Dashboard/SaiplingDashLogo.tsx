import { useEffect, useRef, useState } from 'react';

interface SaiplingDashLogoProps {
  size?: number;
  className?: string;
}

export function SaiplingDashLogo({ size = 60, className }: SaiplingDashLogoProps) {
  const strokeRef = useRef<SVGPathElement>(null);
  const [showFill, setShowFill] = useState(false);
  const [drawStroke, setDrawStroke] = useState(false);

  useEffect(() => {
    const fillTimer = setTimeout(() => setShowFill(true), 200);
    const strokeTimer = setTimeout(() => setDrawStroke(true), 500);
    return () => {
      clearTimeout(fillTimer);
      clearTimeout(strokeTimer);
    };
  }, []);

  useEffect(() => {
    const el = strokeRef.current;
    if (!el) return;
    if (drawStroke) {
      const length = el.getTotalLength();
      el.style.strokeDasharray = `${length}`;
      el.style.strokeDashoffset = `${length}`;
      el.getBoundingClientRect();
      el.style.transition = 'stroke-dashoffset 2.5s ease-in-out';
      el.style.strokeDashoffset = '0';
    }
  }, [drawStroke]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="540 190 500 690"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fill="#3cf281"
        d="M742.8,410.3c16.8-5.1,34.8-7.1,52.2-7.8c37.5-1.4,76.2,6,109.3,24.1c61,33.4,102.6,114.9,64.7,180.4
          c-3.9,6.7-8.5,12.9-13.6,18.7c-34.4,38.6-91.8,53.1-141.8,51.9c-35.9-0.9-71.7-14-99.1-37.2c-30.3-25.7-46.4-63.3-47.8-102.7
          c-0.5-14.7,0.2-29.7,2.4-44.3c4-26.2,18.4-50.3,39.6-66.3C719,419.4,730.6,414,742.8,410.3z"
        style={{
          opacity: showFill ? 1 : 0,
          transition: 'opacity 0.5s ease-in',
        }}
      />
      <path
        ref={strokeRef}
        fill="none"
        stroke="var(--logo-stroke)"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeMiterlimit="10"
        d="M767.6,826.6l41,25.5c9.6,5.9,21.7,6,31.3,0.1l57.5-35.3c0.2-0.1,0.1-0.5-0.1-0.5l-136.7-3.4
          c-6.2-0.2-11.2-5.2-11.2-11.4v-0.8c0-5.8,4.3-10.7,10-11.4l132.2-16.4c5.7-0.7,9.9-5.8,9.4-11.7c-0.5-6.2-6.5-10.5-12.7-9.6
          l-126,17.2c-7.3,1-13.8-5.1-12.9-12.7c0.6-5.3,5-9.4,10.3-10.1l135.8-17.5c3.5-0.5,6-3.7,5.5-7.4c-0.5-3.1-3.4-5.3-6.6-5.3H763.8
          c-14.4,0-27.6-8.2-33.8-21.2c-2.5-5.2-4.7-11.5-6.2-19.3c-5.6-27.9-6.3-56.7-17.1-83.3c-25-61.8-69.6-103.5-73.2-173.2
          c-3.7-71.6,40.6-138.2,94.4-169.4c53.9-31.2,170.2-53,251,49.9c46.2,59.4,46.7,145.3,19.1,196.2c-24.6,41.9-35.7,54.5-46.7,79
          c-11,24.5-15.8,42.7-20.8,80.8s-17,44.5-38.1,48.7c-12.2,1.8-42.5,1-63.7,0.2c-1.7-0.1-3.1-1.5-3.2-3.2
          c-0.3-16.8-2.2-94.4-1.3-119.1c1-27.2,23.1-54.8,23.1-54.8c1.3-2,12.6,1.6,14.4,1.9c41.1,5.9,76.6-23.6,96.5-56.8
          c5.7-9.5,10.6-19.4,16.5-28.7c2.8-4.4,5.9-9.1,10.2-12.1c8.2-5.7-64.7-17.5-110.3,16.8c-33.7,25.4-33,66-33.5,69.8
          c-0.5,3.8,6,7.8,18.7-7.6s45.8-44.1,61.3-50.7c4.3-2.6-36.6,13.6-58.1,33.5c-21.5,19.9-39.2,63-39.8,60.1
          c-0.6-2.4-0.6-9.7-0.2-18.8s1.9-31.7,0.7-31.2c-1.1,0.5-6.2,5.6-7.6,14.9s0.8,27.1-1.4,24c-2.2-3.1-14.6-30.6-35-46.9
          s-57.9-27.9-53.9-25.9c14.3,4.8,45.6,28.2,57.9,41c12.3,12.8,17.7,8.8,17.1,5.5s-2.8-39.5-34.4-59.8c-42.8-27.4-106.7-12-99.1-7.5
          c7.6,4.5,15.9,19.1,26.4,34.7c22.2,33.1,58.5,52.2,98.1,41.6c0.8-0.2,3.5-1.3,4.2-0.4c14.2,18.7,18.2,35.5,18.7,56
          c0.4,18.3-2.9,102.6-4.2,119.5c-0.1,1.7-1.5,3-3.2,3l-46.2,0.1"
        style={{
          opacity: drawStroke ? 1 : 0,
        }}
      />
    </svg>
  );
}
