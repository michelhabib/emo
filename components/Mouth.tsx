import { Circle, PaintStyle, Skia } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';

export interface MouthProps {
  cx: number;
  cy: number;
  /** Optional fill colour. Defaults to yellow */
  color?: string;
  radius?: number;
  /** Probability (0-1) that the person is smiling. If provided and below
   *  threshold, the Mouth component will not render. */
  smilingProbability?: number;
  /** Probability threshold required to render the mouth (defaults to 0.5) */
  threshold?: number;
}

const DEFAULT_MOUTH_RADIUS = 6;

/**
 * Pure drawing component for mouth landmark (rendered when smiling).
 */
const Mouth: React.FC<MouthProps> = ({
  cx,
  cy,
  radius,
  color = 'yellow',
  smilingProbability,
  threshold = 0.5,
}) => {
  // If probability provided and below threshold, render nothing
  if (smilingProbability !== undefined && smilingProbability < threshold) {
    return null;
  }

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