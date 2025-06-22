import { Canvas } from '@shopify/react-native-skia';
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Camera, Frame, runAtTargetFps, useCameraDevices, useFrameProcessor } from 'react-native-vision-camera';
import { Face, FaceDetectionOptions, useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { crop } from 'vision-camera-cropper';

import Eye from '@/components/Eye';
import FaceRect from '@/components/FaceRect';
import Mouth from '@/components/Mouth';

// Default size of the preview window (can be overridden via props)
const DEFAULT_W = 150;
const DEFAULT_H = 200;

export interface SmartCameraProps {
  /** Size of the preview overlay */
  width?: number;
  height?: number;

  /** Detection tuning */
  performanceMode?: 'fast' | 'accurate';
  landmarkMode?: 'all' | 'none';
  minFaceSize?: number;
  cameraFacing?: 'front' | 'back';
  targetFps?: number;

  /** Drawing toggles */
  showFace?: boolean;
  showEyes?: boolean;
  showMouth?: boolean;

  /** Overlay placement */
  top?: number;
  right?: number;

  /** Absolute style override for the camera container */
  style?: object;

  /** Callback fired each time eye centres are re-computed (percent of overlay [0-1]) */
  onEyeCentres?: (data: EyeCentres | null) => void;

  /** One-shot snapshot callback – receives file path (or base64 fallback) */
  onSnapshot?: (uri: string) => void;
}

export interface SmartCameraHandle {
  /** Trigger a one-shot snapshot. The next frame with a detected face will be cropped and returned via onSnapshot. */
  captureSnapshot: () => void;
}

/** Normalised eye–centre positions (percent of overlay width/height). */
export type EyeCentres = {
  left?: { xPct: number; yPct: number };
  right?: { xPct: number; yPct: number };
};

/**
 * Encapsulates the Vision-Camera + Skia overlay logic used to display
 * detected faces, eyes & mouth landmarks. Designed as a drop-in overlay
 * that can sit on top of any other content (e.g., BabylonWebView).
 */
const SmartCameraComponent = (
  props: SmartCameraProps,
  ref: React.Ref<SmartCameraHandle>
) => {
  const {
    width = DEFAULT_W,
    height = DEFAULT_H,

    performanceMode = 'fast',
    landmarkMode = 'all',
    minFaceSize = 0.15,
    cameraFacing = 'front',
    targetFps = 2,

    showFace = true,
    showEyes = true,
    showMouth = true,

    top = 400,
    right = 20,

    style,

    onEyeCentres,

    onSnapshot,
  } = props;

  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode,
    classificationMode: 'all',
    minFaceSize,
    landmarkMode,
    cameraFacing,
  }).current;

  const devices = useCameraDevices();
  const device = devices.find((d) => d.position === cameraFacing) ?? devices[0];

  const { detectFaces } = useFaceDetector(faceDetectionOptions);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      console.log('[SmartCamera] camera permission:', status);
    })();
  }, [device]);

  const TARGET_FPS = targetFps;
  const deviceOrientation = device?.sensorOrientation;

  // ------------------------------------------------------------------
  // Types + React state that stores READY-TO-DRAW face data (already
  // scaled and mirrored for the preview)
  // ------------------------------------------------------------------
  type DrawableEye = {
    cx: number;
    cy: number;
    open: boolean;
    color: string;
  };

  type DrawableMouth = {
    cx: number;
    cy: number;
    color: string;
    smilingProbability?: number;
  };

  type DrawableFace = {
    rect: { x: number; y: number; width: number; height: number; color: string; strokeWidth: number };
    leftEye?: DrawableEye;
    rightEye?: DrawableEye;
    mouth?: DrawableMouth;
  };

  const [facesData, setFacesData] = React.useState<DrawableFace[]>([]);

  /* ------------------------------------------------------------------
   * Snapshot shared values + imperative handle
   * ----------------------------------------------------------------*/
  const snapFlag = useSharedValue(0);        // increments on each request
  const lastSnapHandled = useSharedValue(0); // last processed value (worklet)

  useImperativeHandle(ref, () => ({
    captureSnapshot: () => {
      snapFlag.value = snapFlag.value + 1;
    },
  }), [snapFlag]);

  // Called from the worklet on the JS thread
  const updateFacesOnJS = Worklets.createRunOnJS((faces: Face[], frame: Frame) => {
    // Determine if frame is landscape and swap dimensions accordingly
    const isLandscape = frame.orientation === 'landscape-left' || frame.orientation === 'landscape-right';
    const frameW = isLandscape ? frame.height : frame.width;
    const frameH = isLandscape ? frame.width : frame.height;

    const sx = width / frameW;
    const sy = height / frameH;
    const mirrorX = (x: number, w: number) => width - x - w;

    const processed: DrawableFace[] = faces.map((face) => {
      const rect = {
        x: mirrorX(face.bounds.x * sx, face.bounds.width * sx),
        y: face.bounds.y * sy,
        width: face.bounds.width * sx,
        height: face.bounds.height * sy,
        color: 'red',
        strokeWidth: 4,
      };

      const leftEye = face.landmarks?.LEFT_EYE
        ? {
            cx: width - face.landmarks.LEFT_EYE.x * sx,
            cy: face.landmarks.LEFT_EYE.y * sy,
            open: face.leftEyeOpenProbability !== undefined && face.leftEyeOpenProbability > 0.5,
            color: 'red',
          }
        : undefined;

      const rightEye = face.landmarks?.RIGHT_EYE
        ? {
            cx: width - face.landmarks.RIGHT_EYE.x * sx,
            cy: face.landmarks.RIGHT_EYE.y * sy,
            open: face.rightEyeOpenProbability !== undefined && face.rightEyeOpenProbability > 0.5,
            color: 'cyan',
          }
        : undefined;

      const mouth = face.landmarks?.MOUTH_BOTTOM
        ? {
            cx: width - face.landmarks.MOUTH_BOTTOM.x * sx,
            cy: face.landmarks.MOUTH_BOTTOM.y * sy,
            color: 'yellow',
            smilingProbability: face.smilingProbability,
          }
        : undefined;

      return { rect, leftEye, rightEye, mouth };
    });

    setFacesData(processed);

    // ------------------------------------------------------------------
    // Notify parent with normalised eye positions (0-1). Use first face.
    // ------------------------------------------------------------------
    if (onEyeCentres) {
      if (processed.length === 0) {
        onEyeCentres(null);
      } else {
        const f = processed[0];
        onEyeCentres({
          left: f.leftEye ? { xPct: f.leftEye.cx / width, yPct: f.leftEye.cy / height } : undefined,
          right: f.rightEye ? { xPct: f.rightEye.cx / width, yPct: f.rightEye.cy / height } : undefined,
        });
      }
    }

    // Debug log
    const { width: scrW, height: scrH, scale, fontScale } = Dimensions.get('window');
    // console.log(`Screen resolution: ${scrW} × ${scrH}  |  scale=${scale}  fontScale=${fontScale}`);
    // faces.forEach((_, idx) => {
    //   console.log(`Frame[${idx}] size1: ${frame.width}x${frame.height}`);
    //   console.log('Frame orientation - ', frame.orientation);
    //   console.log('Device orientation - ', deviceOrientation);
    // });
  });

  // JS-thread bridge for snapshot results
  const deliverSnapshotOnJS = Worklets.createRunOnJS((uri: string) => {
    if (onSnapshot) {
      onSnapshot(uri);
    }
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAtTargetFps(TARGET_FPS, () => {
        'worklet';
        const faces = detectFaces(frame);
        updateFacesOnJS(faces, frame);
        const isLandscape = frame.orientation === 'landscape-left' || frame.orientation === 'landscape-right';
        const frameW = isLandscape ? frame.height : frame.width;
        const frameH = isLandscape ? frame.width : frame.height;
        // ------------------------------------------------------------------
        // Snapshot logic – crop first detected face when requested
        // ------------------------------------------------------------------
        if (snapFlag.value > lastSnapHandled.value && faces.length > 0) {
          const face = faces[0];
          const cropRegion = {
            left: (face.bounds.x / frameW) * 100,
            top: (face.bounds.y / frameH) * 100,
            width: (face.bounds.width / frameW) * 100,
            height: (face.bounds.height / frameH) * 100,
          };
          console.log('[SmartCamera] cropRegion', cropRegion);
          const result = crop(frame, {
            cropRegion,
            includeImageBase64: true,
            saveAsFile: true,
          });
          if (result && result.path) {
            deliverSnapshotOnJS(result.path);
          } else if (result && result.base64) {
            deliverSnapshotOnJS(result.base64);
          }
          lastSnapHandled.value = snapFlag.value;
        }
      });
    },
    [snapFlag]
  );

  if (!device) {
    return <Text>No Camera Device</Text>;
  }

  return (
    <View
      style={[
        styles.cameraContainer,
        { width, height, top, right },
        style,
      ]}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
      />

      <Canvas style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }] }>
        {facesData.map((face, idx) => (
          <React.Fragment key={idx}>
            {showFace && <FaceRect {...face.rect} />}
            {showEyes && face.leftEye && <Eye {...face.leftEye} />}
            {showEyes && face.rightEye && <Eye {...face.rightEye} />}
            {showMouth && face.mouth && <Mouth {...face.mouth} />}
          </React.Fragment>
        ))}
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  cameraContainer: {
    position: 'absolute',
    top: 400,
    right: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
});

export default forwardRef<SmartCameraHandle, SmartCameraProps>(SmartCameraComponent); 