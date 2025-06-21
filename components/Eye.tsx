import { Circle, PaintStyle, Skia } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';

export interface EyeProps {
  cx: number;
  cy: number;
  /** Whether the eye is considered open; determines radius */
  open: boolean;
  /** Optional fill colour. Defaults to red. */
  color?: string;
  radiusClosed?: number;
  radiusOpen?: number;
}

const DEFAULT_RADIUS_CLOSED = 4;
const DEFAULT_RADIUS_OPEN = 7;

/**
 * Pure drawing component for a single eye landmark.
 */
const Eye: React.FC<EyeProps> = ({
  cx,
  cy,
  open,
  color = 'red',
  radiusClosed,
  radiusOpen,
}) => {
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setStyle(PaintStyle.Fill);
    return p;
  }, [color]);

  const closedR = radiusClosed ?? DEFAULT_RADIUS_CLOSED;
  const openR = radiusOpen ?? DEFAULT_RADIUS_OPEN;

  const r = open ? openR : closedR;
  return <Circle cx={cx} cy={cy} r={r} paint={paint} />;
};

export default Eye; 