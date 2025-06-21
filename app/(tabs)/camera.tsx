import { Canvas } from '@shopify/react-native-skia';
import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Frame, runAtTargetFps, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { Face, FaceDetectionOptions, useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import Eye from '../../components/Eye';
import FaceRect from '../../components/FaceRect';
import Mouth from '../../components/Mouth';

const PREVIEW_W = 300;
const PREVIEW_H = 400;

export default function CameraScreen() {
  /** ----------------------------------------------------------
   * 1️⃣  All hooks must be called before any conditional returns
   * --------------------------------------------------------- */
  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: 'fast',
    classificationMode: 'all',
    minFaceSize: 0.15,
    landmarkMode: 'all',
    //autoMode: true,
  }).current;

  const device = useCameraDevice('front');
  const { detectFaces } = useFaceDetector(faceDetectionOptions);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      console.log({ status });
    })();
  }, [device]);

  // Preview size constants (must be defined before using in callbacks)
  const TARGET_FPS = 10;

  const mirrorX = (x: number, w: number) => PREVIEW_W - x - w;
  const deviceOrientation = device?.sensorOrientation;

  // React state for faces & the original frame size
  const [facesData, setFacesData] = React.useState<Face[]>([]);
  const [frameInfo, setFrameInfo] =
    React.useState<{ width: number; height: number; orientation: string } | null>(null);

  // Called from the worklet on the JS thread; includes verbose logging
  const updateFacesOnJS = Worklets.createRunOnJS(
    (faces: Face[], frame: Frame) => {
      setFacesData(faces);
      setFrameInfo({
        width: frame.width,
        height: frame.height,
        orientation: frame.orientation,
      });
      // Debug logs --------------------------------------------------------
      const sx = PREVIEW_W / frame.width;
      const sy = PREVIEW_H / frame.height;
      const { width, height, scale, fontScale } = Dimensions.get('window');
      //console.log(`Screen resolution: ${width} × ${height}  |  scale=${scale}  fontScale=${fontScale}`);
    
      faces.forEach((face, idx) => {
        const dispX = mirrorX(face.bounds.x * sx, face.bounds.width * sx);
        const dispY = face.bounds.y * sy;
        const dispW = face.bounds.width * sx;
        const dispH = face.bounds.height * sy;      

        console.log(`Frame[${idx}] size1: ${frame.width}x${frame.height}`);
        // log frame orientation and frame isMirrored
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

  // Adjust scaling based on frame orientation -----------------------------
  // Landscape if the camera sensor orientation corresponds to landscape
  const isLandscape =
    deviceOrientation === 'landscape-left' || deviceOrientation === 'landscape-right';

  const sx = frameInfo ? PREVIEW_W / (isLandscape ? frameInfo.height : frameInfo.width) : 1;
  const sy = frameInfo ? PREVIEW_H / (isLandscape ? frameInfo.width  : frameInfo.height) : 1;

  /** ----------------------------------------------------------
   * 2️⃣  Native build: Camera preview and overlay
   * --------------------------------------------------------- */
  return (
    <SafeAreaView style={styles.container}>
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
                <FaceRect
                  x={PREVIEW_W - (face.bounds.x + face.bounds.width) * sx}
                  y={face.bounds.y * sy}
                  width={face.bounds.width * sx}
                  height={face.bounds.height * sy}
                  color="red"
                  strokeWidth={4}
                />

                {/* Left Eye */}
                {face.landmarks?.LEFT_EYE && (
                  <Eye
                    cx={PREVIEW_W - face.landmarks.LEFT_EYE.x * sx}
                    cy={face.landmarks.LEFT_EYE.y * sy}
                    open={
                      face.leftEyeOpenProbability !== undefined &&
                      face.leftEyeOpenProbability > 0.5
                    }
                    color="red"
                  />
                )}

                {/* Right Eye */}
                {face.landmarks?.RIGHT_EYE && (
                  <Eye
                    cx={PREVIEW_W - face.landmarks.RIGHT_EYE.x * sx}
                    cy={face.landmarks.RIGHT_EYE.y * sy}
                    open={
                      face.rightEyeOpenProbability !== undefined &&
                      face.rightEyeOpenProbability > 0.5
                    }
                    color="cyan"
                  />
                )}

                {/* Mouth (only when smiling) */}
                {face.smilingProbability !== undefined &&
                  face.smilingProbability > 0.5 &&
                  face.landmarks?.MOUTH_BOTTOM && (
                    <Mouth
                      cx={PREVIEW_W - face.landmarks.MOUTH_BOTTOM.x * sx}
                      cy={face.landmarks.MOUTH_BOTTOM.y * sy}
                      color="yellow"
                    />
                  )}
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
    // position: 'absolute',
    // top: 50,
    // right: 20,
    // borderRadius: 10,
    // borderWidth: 2,
    // borderColor: '#fff',
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.25,
    // shadowRadius: 3.84,
    // elevation: 5,
  },
}); 