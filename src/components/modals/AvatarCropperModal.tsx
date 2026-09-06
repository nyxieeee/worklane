import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, Check, X, Move } from 'lucide-react';

interface Props {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onApply: (croppedDataUrl: string) => void;
}

const CROP_SIZE = 260; // Diameter of the crop circle in px
const OUTPUT_SIZE = 256; // Resolution of exported avatar image (retina quality, compact payload)

export default function AvatarCropperModal({
  isOpen,
  imageSrc,
  onClose,
  onApply,
}: Props) {
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const imgRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number }>({
    mouseX: 0,
    mouseY: 0,
    panX: 0,
    panY: 0,
  });
  const touchDistanceRef = useRef<number | null>(null);

  // Calculate base scale so image always covers the circle
  const baseScale = React.useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return 1;
    const isRotated90 = rotation % 180 !== 0;
    const w = isRotated90 ? naturalSize.height : naturalSize.width;
    const h = isRotated90 ? naturalSize.width : naturalSize.height;
    return Math.max(CROP_SIZE / w, CROP_SIZE / h);
  }, [naturalSize, rotation]);

  // Calculate maximum pan bounds
  const maxPan = React.useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return { x: 0, y: 0 };
    const isRotated90 = rotation % 180 !== 0;
    const w = isRotated90 ? naturalSize.height : naturalSize.width;
    const h = isRotated90 ? naturalSize.width : naturalSize.height;
    const currentW = w * baseScale * zoom;
    const currentH = h * baseScale * zoom;
    return {
      x: Math.max(0, (currentW - CROP_SIZE) / 2),
      y: Math.max(0, (currentH - CROP_SIZE) / 2),
    };
  }, [naturalSize, rotation, baseScale, zoom]);

  // Clamp pan within valid bounds
  const clampPan = useCallback((x: number, y: number, currentMaxPan = maxPan) => {
    return {
      x: Math.min(currentMaxPan.x, Math.max(-currentMaxPan.x, x)),
      y: Math.min(currentMaxPan.y, Math.max(-currentMaxPan.y, y)),
    };
  }, [maxPan]);

  // Load natural image dimensions when imageSrc changes
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1.0);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Re-clamp pan when zoom or rotation changes
  useEffect(() => {
    setPan(prev => clampPan(prev.x, prev.y));
  }, [zoom, rotation, clampPan]);

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;
      setPan(clampPan(dragStartRef.current.panX + deltaX, dragStartRef.current.panY + deltaY));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, clampPan]);

  // Touch Handlers (Pan & Pinch-to-zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        mouseX: e.touches[0].clientX,
        mouseY: e.touches[0].clientY,
        panX: pan.x,
        panY: pan.y,
      };
      touchDistanceRef.current = null;
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const deltaX = e.touches[0].clientX - dragStartRef.current.mouseX;
      const deltaY = e.touches[0].clientY - dragStartRef.current.mouseY;
      setPan(clampPan(dragStartRef.current.panX + deltaX, dragStartRef.current.panY + deltaY));
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / touchDistanceRef.current;
      setZoom(z => Math.min(3.5, Math.max(1.0, +(z * factor).toFixed(2))));
      touchDistanceRef.current = currentDist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchDistanceRef.current = null;
  };

  // Wheel Zoom Handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom(z => Math.min(3.5, Math.max(1.0, +(z + delta).toFixed(2))));
  };

  // Rotate Clockwise
  const handleRotate = () => {
    setRotation(r => (r + 90) % 360);
    setPan({ x: 0, y: 0 });
  };

  // Reset to Default
  const handleReset = () => {
    setZoom(1.0);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Export cropped image onto canvas
  const handleApply = () => {
    if (!naturalSize.width || !naturalSize.height || !imgRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const ratio = OUTPUT_SIZE / CROP_SIZE;

    // Center transform
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
    ctx.translate(pan.x * ratio, pan.y * ratio);
    ctx.rotate((rotation * Math.PI) / 180);

    const totalScale = baseScale * zoom * ratio;
    ctx.scale(totalScale, totalScale);

    ctx.drawImage(
      imgRef.current,
      -naturalSize.width / 2,
      -naturalSize.height / 2,
      naturalSize.width,
      naturalSize.height
    );

    // Export as high quality JPEG (sharp, lightweight ~20KB payload)
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    onApply(croppedDataUrl);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="modal-overlay"
        style={{
          perspective: 1200,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="modal"
          style={{
            maxWidth: 440,
            width: '92vw',
            padding: 0,
            overflow: 'hidden',
            backgroundColor: 'hsl(var(--card))',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--neu-shadow-floating)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid hsl(var(--border) / 0.5)',
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))', margin: 0 }}>
                Adjust Profile Picture
              </h3>
              <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: '2px 0 0 0' }}>
                Drag to reposition • Scroll or use slider to zoom
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              className="icon-btn"
              onClick={onClose}
              title="Close"
            >
              <X size={16} />
            </motion.button>
          </div>

          {/* Interactive Crop Viewport Container */}
          <div
            style={{
              padding: '24px 20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'hsl(var(--background))',
            }}
          >
            {/* Viewport Frame */}
            <div
              style={{
                position: 'relative',
                width: CROP_SIZE,
                height: CROP_SIZE,
                borderRadius: '50%',
                boxShadow: 'var(--neu-shadow-raised)',
                border: '3px solid hsl(var(--primary))',
                overflow: 'hidden',
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none',
              }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
            >
              {/* Image Element */}
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Avatar Crop Target"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: naturalSize.width,
                  height: naturalSize.height,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${baseScale * zoom})`,
                  transformOrigin: 'center center',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  display: naturalSize.width ? 'block' : 'none',
                }}
              />

              {/* Rule-of-Thirds Grid Overlay (subtle guides) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  border: '1px dashed hsl(var(--primary) / 0.25)',
                  borderRadius: '50%',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gridTemplateRows: '1fr 1fr 1fr',
                  opacity: isDragging ? 0.7 : 0.25,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.3)', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} />
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.3)', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} />
                <div style={{ borderBottom: '1px dashed rgba(255,255,255,0.3)' }} />
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.3)', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} />
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.3)', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} />
                <div style={{ borderBottom: '1px dashed rgba(255,255,255,0.3)' }} />
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.3)' }} />
                <div style={{ borderRight: '1px dashed rgba(255,255,255,0.3)' }} />
                <div />
              </div>

              {/* Floating Pan Hint Badge */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.55)',
                  backdropFilter: 'blur(4px)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  pointerEvents: 'none',
                  opacity: isDragging ? 0 : 0.85,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <Move size={11} />
                <span>Drag to move</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div
              style={{
                width: '100%',
                marginTop: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Zoom Slider Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  className="icon-btn"
                  style={{ width: 28, height: 28, minWidth: 28 }}
                  onClick={() => setZoom(z => Math.max(1.0, +(z - 0.2).toFixed(2)))}
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </motion.button>

                <input
                  type="range"
                  min="1"
                  max="3.5"
                  step="0.01"
                  value={zoom}
                  onChange={e => setZoom(parseFloat(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: 'hsl(var(--primary))',
                    cursor: 'pointer',
                    height: 6,
                  }}
                  title={`Zoom: ${Math.round(zoom * 100)}%`}
                />

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  className="icon-btn"
                  style={{ width: 28, height: 28, minWidth: 28 }}
                  onClick={() => setZoom(z => Math.min(3.5, +(z + 0.2).toFixed(2)))}
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </motion.button>

                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'hsl(var(--muted-foreground))', minWidth: 38, textAlign: 'right' }}>
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              {/* Extra Tools: Rotate & Reset */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 11.5, padding: '4px 12px', gap: 5 }}
                  onClick={handleRotate}
                  title="Rotate 90° Clockwise"
                >
                  <RotateCw size={13} />
                  <span>Rotate 90°</span>
                </motion.button>

                {(zoom !== 1.0 || rotation !== 0 || pan.x !== 0 || pan.y !== 0) && (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: 11.5, padding: '4px 12px', gap: 5 }}
                    onClick={handleReset}
                    title="Reset to center"
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              borderTop: '1px solid hsl(var(--border) / 0.5)',
              backgroundColor: 'hsl(var(--card))',
            }}
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12.5, padding: '7px 16px' }}
              onClick={onClose}
            >
              Cancel
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 12.5, padding: '7px 18px', gap: 6 }}
              onClick={handleApply}
            >
              <Check size={14} />
              <span>Apply Photo</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
