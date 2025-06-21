package com.anonymous.emo.detectface

import android.annotation.SuppressLint
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

class detectFacePlugin(proxy: VisionCameraProxy, options: Map<String, Any>?): FrameProcessorPlugin() {
  // private val detector = FaceDetection.getClient(
  //   FaceDetectorOptions.Builder()
  //     .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
  //     .build()
  // )

  // Real-time contour detection
  val realTimeOpts = FaceDetectorOptions.Builder()
          .setContourMode(FaceDetectorOptions.CONTOUR_MODE_ALL)
          .build()
        
        
  @SuppressLint("UnsafeOptInUsageError")
  override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
    // val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
    // val image = frame.image
    // val inputImage = InputImage.fromMediaImage(image, frame.orientation)
    // return try {
    //   val faces = Tasks.await(detector.process(inputImage))
    //   faces.map { face -> faceToJson(face) }
    // } catch (e: Exception) {
    //   e.printStackTrace()
    //   emptyList<Map<String, Any>>()
    // }
    return null
  }

  // private fun faceToJson(face: Face): Map<String, Any> {
  //   return mapOf(
  //     "boundingBox" to mapOf(
  //       "left" to face.boundingBox.left,
  //       "top" to face.boundingBox.top,
  //       "right" to face.boundingBox.right,
  //       "bottom" to face.boundingBox.bottom
  //     ),
  //     "trackingId" to (face.trackingId ?: -1)
  //   )
  // }
}