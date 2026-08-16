import {CaptureIntent} from "./CaptureIntent"

@component
export class CaptureIntentProvider extends BaseScriptComponent {
  @input cameraObject!: SceneObject
  @input previewSmallerDimension = 352
  @input deviceSmallerDimension = 512

  private liveTexture: Texture | null = null
  private hasFrame = false
  private latestFrameTimestampSeconds = Number.NaN

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.startCameraStream())
  }

  public capture(): CaptureIntent {
    const transform = this.cameraObject.getTransform()
    const cameraId = this.getCaptureCameraId()
    const deviceCamera = global.deviceInfoSystem.getTrackingCameraForId(cameraId)
    const cameraWorld = transform.getWorldTransform().mult(deviceCamera.pose)
    const origin = cameraWorld.multiplyPoint(vec3.zero())
    const direction = cameraWorld.multiplyDirection(new vec3(0, 0, -1)).normalize()
    const frame = this.hasFrame && this.liveTexture ? this.liveTexture.copyFrame() : null
    const intent: CaptureIntent = {
      frame,
      cameraId,
      frameWidth: frame ? frame.getWidth() : 0,
      frameHeight: frame ? frame.getHeight() : 0,
      origin: new vec3(origin.x, origin.y, origin.z),
      direction: new vec3(direction.x, direction.y, direction.z),
      timestampSeconds: this.latestFrameTimestampSeconds,
      toWorldTrackingOriginFromDeviceRef: transform.getWorldTransform(),
      source: global.deviceInfoSystem.isEditor() ? "preview-camera" : "specs-camera",
    }
    print(`[HotNCold][Capture] froze ${intent.source} frame=${frame ? "YES" : "NO"} origin=${this.format(origin)} direction=${this.format(direction)} t=${intent.timestampSeconds.toFixed(3)}`)
    return intent
  }

  private startCameraStream(): void {
    try {
      const cameraModule = require("LensStudio:CameraModule") as CameraModule
      const request = CameraModule.createCameraRequest()
      request.cameraId = this.getCaptureCameraId()
      request.imageSmallerDimension = global.deviceInfoSystem.isEditor() ? this.previewSmallerDimension : this.deviceSmallerDimension
      this.liveTexture = cameraModule.requestCamera(request)
      const provider = this.liveTexture.control as CameraTextureProvider
      provider.onNewFrame.add((cameraFrame: CameraFrame) => {
        this.hasFrame = true
        this.latestFrameTimestampSeconds = cameraFrame.timestampSeconds
      })
      print(`[HotNCold][Capture] ${global.deviceInfoSystem.isEditor() ? "Preview" : "Specs"} camera stream readying`)
    } catch (error) {
      print(`[HotNCold][Capture] camera stream failed: ${error}`)
    }
  }

  private getCaptureCameraId(): CameraModule.CameraId {
    return CameraModule.CameraId.Default_Color
  }

  private format(value: vec3): string {
    return `(${value.x.toFixed(1)}, ${value.y.toFixed(1)}, ${value.z.toFixed(1)})`
  }
}
