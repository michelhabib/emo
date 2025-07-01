import { Ionicons } from '@expo/vector-icons';
import { Canvas } from '@shopify/react-native-skia';
import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Frame, runAtTargetFps, useCameraDevices, useFrameProcessor } from 'react-native-vision-camera';
import { Face, FaceDetectionOptions, useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { crop } from 'vision-camera-cropper';
import styles from './SmartCamera.styles';

import Eye from '@/components/Eye';
import FaceRect from '@/components/FaceRect';
import Mouth from '@/components/Mouth';

// Default size of the preview window (can be overridden via props)
const DEFAULT_W = 75;
const DEFAULT_H = 100;

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
  /** Trigger a one-shot snapshot of the FULL frame (no face required). */
  captureAllSnapshot: () => void;
  /** Toggle between the front and back camera. */
  switchCamera: () => void;
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

  // ------------------------------------------------------------------
  // Internal camera facing state (can be toggled via imperative handle)
  // ------------------------------------------------------------------
  const [currentFacing, setCurrentFacing] = React.useState<"front" | "back">(cameraFacing);

  // Update the camera devices each render (will switch when currentFacing changes)
  const devices = useCameraDevices();
  const device = devices.find((d) => d.position === currentFacing) ?? devices[0];

  // ------------------------------------------------------------------
  // Face-detection options (re-created whenever dependencies change)
  // ------------------------------------------------------------------
  const faceDetectionOptions = React.useMemo<FaceDetectionOptions>(
    () => ({
      performanceMode,
      classificationMode: "all",
      minFaceSize,
      landmarkMode,
      cameraFacing: currentFacing,
    }),
    [performanceMode, minFaceSize, landmarkMode, currentFacing]
  );

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
  const snapFlag = useSharedValue(0);        // increments on each face-shot request
  const lastSnapHandled = useSharedValue(0); // last processed face-shot id

  const snapAllFlag = useSharedValue(0);        // increments on each FULL-frame request
  const lastSnapAllHandled = useSharedValue(0); // last processed full-shot id

  useImperativeHandle(
    ref,
    () => ({
      captureSnapshot: () => {
        snapFlag.value = snapFlag.value + 1;
      },
      captureAllSnapshot: () => {
        snapAllFlag.value = snapAllFlag.value + 1;
      },
      switchCamera: () => {
        setCurrentFacing((prev) => (prev === "front" ? "back" : "front"));
      },
    }),
    []
  );

  // Called from the worklet on the JS thread
  const updateFacesOnJS = Worklets.createRunOnJS((faces: Face[], frame: Frame) => {
    // Determine if frame is landscape and swap dimensions accordingly
    const isLandscape = frame.orientation === 'landscape-left' || frame.orientation === 'landscape-right';
    const frameW = isLandscape ? frame.height : frame.width;
    const frameH = isLandscape ? frame.width : frame.height;

    const sx = width / frameW;
    const sy = height / frameH;
    const mirrorX = (x: number, w: number) => width - x - w;
    if (faces.length > 0) {
      console.log('detected faces: ', faces.length);
    }

    const processed: DrawableFace[] = faces.map((face) => {
      console.log('Frame is Mirrored: ', frame.isMirrored);
      console.log('window width*height: ', width, height);
      console.log('frame orientation: ', frame.orientation);
      console.log('frame corrected width*height: ', frameW, frameH);
      console.log('frameW * frameH: ', frameW , frameH);
      console.log('scaleX * scaleY: ', sx , sy);
      const rect = {
        x: mirrorX(face.bounds.x * sx, face.bounds.width * sx),
        y: face.bounds.y * sy,
        width: face.bounds.width * sx,
        height: face.bounds.height * sy,
        color: 'red',
        strokeWidth: 4,
      };
      console.log('face rect: ', rect);

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

      // console.log('face landmarks: ', face.landmarks);

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
        // Helper to clamp values between a min/max (worklet-safe)
        const clamp = (v: number, mn: number, mx: number) => {
          'worklet';
          return v < mn ? mn : v > mx ? mx : v;
        };

        // FULL-frame snapshot -------------------------------------------------
        if (snapAllFlag.value > lastSnapAllHandled.value) {
          // Use the same percentage-based convention as face crops
          const cropRegion = {
            left: 0,
            top: 0,
            width: 100,
            height: 100,
          };
          console.log('cropRegion: ', cropRegion);
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
          lastSnapAllHandled.value = snapAllFlag.value;
        }

        // FACE-bounded snapshot ----------------------------------------------
        if (snapFlag.value > lastSnapHandled.value && faces.length > 0) {
          const face = faces[0];

          // Ensure bounds are within the frame dimensions
          const x = clamp(face.bounds.x, 0, frameW);
          const y = clamp(face.bounds.y, 0, frameH);
          const w = clamp(face.bounds.width, 0, frameW - x);
          const h = clamp(face.bounds.height, 0, frameH - y);

          const cropRegion = {
            left: (x / frameW) * 100,
            top: (y / frameH) * 100,
            width: (w / frameW) * 100,
            height: (h / frameH) * 100,
          };
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
    [snapFlag, snapAllFlag]
  );

  if (!device) {
    return <Text>No Camera Device</Text>;
  }

  return (
    <View style={[styles.wrapper, { top, right }] } pointerEvents="box-none">
      {/* Camera Overlay */}
      <View
        style={[
          styles.cameraContainer,
          { width, height },
          style,
        ]}
        pointerEvents="none">
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          frameProcessor={frameProcessor}
          pointerEvents="none"
        />

        <Canvas
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }] }>
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

      {/* Control buttons below the camera */}
      <View style={[styles.controlsRow, { width }]} pointerEvents="auto">
        <Pressable
          style={styles.controlButton}
          onPress={() => {
            snapFlag.value = snapFlag.value + 1;
          }}>
          <Ionicons name="camera-outline" size={24} color="#fff" />
        </Pressable>

        <Pressable
          style={styles.controlButton}
          onPress={() => {
            snapAllFlag.value = snapAllFlag.value + 1;
          }}>
          <Ionicons name="scan-outline" size={24} color="#fff" />
        </Pressable>

        <Pressable
          style={styles.controlButton}
          onPress={() => {
            setCurrentFacing((prev) => (prev === 'front' ? 'back' : 'front'));
          }}>
          <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
};

export default forwardRef<SmartCameraHandle, SmartCameraProps>(SmartCameraComponent); 