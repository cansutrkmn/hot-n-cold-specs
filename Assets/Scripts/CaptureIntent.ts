export interface CaptureIntent {
  frame: Texture | null
  cameraId: CameraModule.CameraId
  frameWidth: number
  frameHeight: number
  origin: vec3
  direction: vec3
  timestampSeconds: number
  toWorldTrackingOriginFromDeviceRef: mat4
  source: "preview-camera" | "specs-camera"
}
