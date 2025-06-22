import BabylonWebView from '@/components/BabylonWebView';
import { Canvas } from '@shopify/react-native-skia';
import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Frame, runAtTargetFps, useCameraDevices, useFrameProcessor } from 'react-native-vision-camera';
import { Face, FaceDetectionOptions, useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import Eye from '../../components/Eye';
import FaceRect from '../../components/FaceRect';
import Mouth from '../../components/Mouth';


const PREVIEW_W = 150;
const PREVIEW_H = 200;

export default function CameraScreen() {
  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: 'fast',
    classificationMode: 'all',
    minFaceSize: 0.1,
    landmarkMode: 'all',
    //autoMode: true,
  }).current;

  const devices = useCameraDevices();
  const device = devices.find((d) => d.position === 'front') ?? devices[0];

  if (!device) {
    console.warn('No camera device found');
  }
  const { detectFaces } = useFaceDetector(faceDetectionOptions);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      console.log({ status });
    })();
  }, [device]);

  // Preview size constants (must be defined before using in callbacks)
  const TARGET_FPS = 10;

  const deviceOrientation = device?.sensorOrientation;

  // ------------------------------------------------------------------
  // React state that stores READY-TO-DRAW face data (already scaled and
  // mirrored for the preview). No further coordinate math is required
  // during render – everything happens inside updateFacesOnJS.
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

  // Called from the worklet on the JS thread; includes verbose logging
  const updateFacesOnJS = Worklets.createRunOnJS(
    (faces: Face[], frame: Frame) => {
      // ---------------------------------------------------------------
      // Determine if the incoming video frame is in landscape and swap
      // width/height accordingly so scaling remains correct.
      // ---------------------------------------------------------------
      const isLandscape =
        frame.orientation === 'landscape-left' || frame.orientation === 'landscape-right';

      const frameW = isLandscape ? frame.height : frame.width;
      const frameH = isLandscape ? frame.width  : frame.height;

      const sx = PREVIEW_W / frameW;
      const sy = PREVIEW_H / frameH;
      const mirrorX = (x: number, w: number) => PREVIEW_W - x - w;

      const processed: DrawableFace[] = faces.map((face) => {
        // Face bounding box (mirrored on X)
        const rect = {
          x: mirrorX(face.bounds.x * sx, face.bounds.width * sx),
          y: face.bounds.y * sy,
          width: face.bounds.width * sx,
          height: face.bounds.height * sy,
          color: 'red',
          strokeWidth: 4,
        };

        // Eyes ----------------------------------------------------------
        const leftEye = face.landmarks?.LEFT_EYE
          ? {
              cx: PREVIEW_W - face.landmarks.LEFT_EYE.x * sx,
              cy: face.landmarks.LEFT_EYE.y * sy,
              open:
                face.leftEyeOpenProbability !== undefined &&
                face.leftEyeOpenProbability > 0.5,
              color: 'red',
            }
          : undefined;

        const rightEye = face.landmarks?.RIGHT_EYE
          ? {
              cx: PREVIEW_W - face.landmarks.RIGHT_EYE.x * sx,
              cy: face.landmarks.RIGHT_EYE.y * sy,
              open:
                face.rightEyeOpenProbability !== undefined &&
                face.rightEyeOpenProbability > 0.5,
              color: 'cyan',
            }
          : undefined;

        // Mouth (always include if landmark exists – the Mouth component
        // itself decides whether to render based on the smiling probability)
        const mouth = face.landmarks?.MOUTH_BOTTOM
          ? {
              cx: PREVIEW_W - face.landmarks.MOUTH_BOTTOM.x * sx,
              cy: face.landmarks.MOUTH_BOTTOM.y * sy,
              color: 'yellow',
              smilingProbability: face.smilingProbability,
            }
          : undefined;

        return { rect, leftEye, rightEye, mouth };
      });

      setFacesData(processed);

      // Debug logs --------------------------------------------------------
      const { width, height, scale, fontScale } = Dimensions.get('window');
      console.log(`Screen resolution: ${width} × ${height}  |  scale=${scale}  fontScale=${fontScale}`);
    
      faces.forEach((_, idx) => {
        console.log(`Frame[${idx}] size1: ${frame.width}x${frame.height}`);
        // log frame orientation and device orientation
        console.log('Frame orientation - ', frame.orientation);
        console.log('Device orientation - ', deviceOrientation);
      });
      // -------------------------------------------------------------------
    }
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAtTargetFps(TARGET_FPS, () => {
        'worklet';
        // Detect faces in the current frame (worklet-side)
        const faces = detectFaces(frame);
        // Pass faces + the frame dimensions back to the JS thread
        updateFacesOnJS(faces, frame);
      });
    },
    [] // no JS-world dependencies inside the worklet
  );

  return (
    <SafeAreaView style={styles.container}>
      <BabylonWebView style={{ flex: 1 }} />
      {device ? (
        <View style={styles.cameraContainer}>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            frameProcessor={frameProcessor}
          />

          {/* Skia Canvas overlay for drawing face rectangles */}
          <Canvas style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(0,0,0,0.25)'}]}>
            {facesData.map((face, idx) => (
              <React.Fragment key={idx}>
                {/* Face bounding box */}
                <FaceRect {...face.rect} />

                {/* Left Eye */}
                {face.leftEye && <Eye {...face.leftEye} />}

                {/* Right Eye */}
                {face.rightEye && <Eye {...face.rightEye} />}

                {/* Mouth (already filtered for smiling) */}
                {face.mouth && <Mouth {...face.mouth} />}
              </React.Fragment>
            ))}
          </Canvas>
        </View>
      ) : (
        <Text>No Camera Device</Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cameraContainer: {
//    flex: 1,
    width: PREVIEW_W,
    height: PREVIEW_H,
    overflow: 'hidden',
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
  },
});