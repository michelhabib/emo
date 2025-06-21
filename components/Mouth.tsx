import { Circle, PaintStyle, Skia } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';

export interface MouthProps {
  cx: number;
  cy: number;
  /** Optional fill colour. Defaults to yellow */
  color?: string;
  radius?: number;
}

const DEFAULT_MOUTH_RADIUS = 6;

/**
 * Pure drawing component for mouth landmark (rendered when smiling).
 */
const Mouth: React.FC<MouthProps> = ({ cx, cy, radius, color = 'yellow' }) => {
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setStyle(PaintStyle.Fill);
    return p;
  }, [color]);

  const r = radius ?? DEFAULT_MOUTH_RADIUS;

  return <Circle cx={cx} cy={cy} r={r} paint={paint} />;
};

export default Mouth; 