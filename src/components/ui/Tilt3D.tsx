import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useIsMobile } from '../../utils';

interface Tilt3DProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxTilt?: number;
  scale?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  disabled?: boolean;
}

export default function Tilt3D({
  children,
  className = '',
  style = {},
  maxTilt = 12,
  scale = 1.02,
  onClick,
  disabled = false,
}: Tilt3DProps) {
  const isMobile = useIsMobile(860);
  const isEffectivelyDisabled = disabled || isMobile;
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const springConfig = { damping: 20, stiffness: 260, mass: 0.5 };
  const rotateX = useSpring(useTransform(y, [0, 1], [maxTilt, -maxTilt]), springConfig);
  const rotateY = useSpring(useTransform(x, [0, 1], [-maxTilt, maxTilt]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEffectivelyDisabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const clientX = (e.clientX - rect.left) / rect.width;
    const clientY = (e.clientY - rect.top) / rect.height;
    x.set(clientX);
    y.set(clientY);
  };

  const handleMouseLeave = () => {
    if (isEffectivelyDisabled) return;
    x.set(0.5);
    y.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        width: '100%',
        minWidth: 0,
        perspective: isEffectivelyDisabled ? undefined : 1000,
        transformStyle: isEffectivelyDisabled ? undefined : 'preserve-3d',
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileHover={isEffectivelyDisabled ? undefined : { scale }}
      whileTap={isEffectivelyDisabled ? undefined : { scale: 0.98 }}
    >
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          rotateX: isEffectivelyDisabled ? 0 : rotateX,
          rotateY: isEffectivelyDisabled ? 0 : rotateY,
          transformStyle: isEffectivelyDisabled ? undefined : 'preserve-3d',
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
