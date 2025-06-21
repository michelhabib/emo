import { PaintStyle, Rect, Skia } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';

export interface FaceRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Stroke colour of the rectangle. Defaults to 'red'. */
  color?: string;
  /** Stroke width. Defaults to 4. */
  strokeWidth?: number;
}

/**
 * Pure drawing component that renders a rectangular face bounding box.
 * All coordinate calculations should be done by the caller so this
 * component stays presentation-only.
 */
const FaceRect: React.FC<FaceRectProps> = ({
  x,
  y,
  width,
  height,
  color = 'red',
  strokeWidth = 4,
}) => {
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(strokeWidth);
    return p;
  }, [color, strokeWidth]);

  return <Rect x={x} y={y} width={width} height={height} paint={paint} />;
};

export default FaceRect; 