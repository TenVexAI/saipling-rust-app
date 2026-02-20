import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizeDividerProps {
  onResize: (delta: number) => void;
  direction?: 'horizontal' | 'vertical';
}

export function ResizeDivider({ onResize, direction = 'horizontal' }: ResizeDividerProps) {
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    setDragging(true);
  }, [direction]);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const current = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = current - lastPos.current;
      lastPos.current = current;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, direction, onResize]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: isHorizontal ? '1px' : '100%',
        height: isHorizontal ? '100%' : '1px',
        cursor: isHorizontal ? 'col-resize' : 'row-resize',
        backgroundColor: dragging ? 'var(--accent)' : 'var(--border-primary)',
        flexShrink: 0,
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: isHorizontal ? '-3px' : 0,
          right: isHorizontal ? '-3px' : 0,
          bottom: isHorizontal ? 0 : undefined,
          height: isHorizontal ? '100%' : '10px',
          marginTop: isHorizontal ? 0 : '-3px',
        }}
      />
    </div>
  );
}
