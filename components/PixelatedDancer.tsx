import React, { useRef, useEffect, useState } from 'react';

interface PixelatedDancerProps {
  imageSrc: string;
  amplitude: number; // 0 to 1, from audio analysis
  pixelSize?: number; // Optional: size of the pixel blocks
  width?: number;
  height?: number;
}

const PixelatedDancer: React.FC<PixelatedDancerProps> = ({
  imageSrc,
  amplitude,
  pixelSize = 12,
  width = 300,
  height = 700,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Draw pixelated image
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imgRef.current;
    if (!canvas || !ctx || !img || !imgLoaded) return;
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Bobbing animation: amplitude controls vertical offset
    const bob = amplitude * 30; // max 30px up
    const yOffset = bob;

    // Draw at low resolution, then scale up for pixelation
    const pixelW = Math.floor(width / pixelSize);
    const pixelH = Math.floor(height / pixelSize);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, pixelW, pixelH);
    ctx.drawImage(
      canvas,
      0,
      0,
      pixelW,
      pixelH,
      0,
      yOffset,
      width,
      height
    );
  }, [imageSrc, amplitude, pixelSize, width, height, imgLoaded]);

  return (
    <div style={{ width, height, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: 'block' }}
      />
      {/* Hidden image for drawing */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt="Pixelated Dancer"
        style={{ display: 'none' }}
        crossOrigin="anonymous"
        onLoad={() => setImgLoaded(true)}
      />
    </div>
  );
};

export default PixelatedDancer; 