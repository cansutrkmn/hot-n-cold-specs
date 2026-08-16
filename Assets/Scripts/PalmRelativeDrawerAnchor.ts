import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import TrackedHand from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

@component
export class PalmRelativeDrawerAnchor extends BaseScriptComponent {
  @input drawerHost!: SceneObject

  private leftHand!: TrackedHand
  private cameraTransform!: Transform
  private drawerTransform!: Transform
  private fallbackLocalPosition!: vec3
  private fallbackLocalRotation!: quat
  private active = false
  private elapsed = 0
  private lockedPosition = vec3.zero()
  private readonly outwardCm = 11
  private readonly upwardCm = 7
  private readonly forwardCm = 2
  private readonly initialFollowSeconds = 0.5
  private readonly reanchorDistanceCm = 6
  private readonly smoothingRate = 11

  onAwake(): void {
    this.leftHand = SIK.HandInputData.getHand("left")
    this.cameraTransform = WorldCameraFinderProvider.getInstance().getComponent().getTransform()
    this.drawerTransform = this.drawerHost.getTransform()
    this.fallbackLocalPosition = this.drawerTransform.getLocalPosition()
    this.fallbackLocalRotation = this.drawerTransform.getLocalRotation()
    this.createEvent("UpdateEvent").bind(() => this.updateAnchor())
  }

  public beginPalmPlacement(): boolean {
    const center = this.leftHand.getPalmCenter()
    if (!this.leftHand.isTracked() || center === null) return false
    this.active = true
    this.elapsed = 0
    this.lockedPosition = this.getDesiredPosition(center)
    this.drawerTransform.setWorldPosition(this.lockedPosition)
    this.faceCamera(this.lockedPosition)
    return true
  }

  public endPalmPlacement(): void {
    if (!this.active) return
    this.active = false
    this.drawerTransform.setLocalPosition(this.fallbackLocalPosition)
    this.drawerTransform.setLocalRotation(this.fallbackLocalRotation)
  }

  public isPalmPlacementActive(): boolean { return this.active }
  public getDrawerWorldPosition(): vec3 { return this.drawerTransform.getWorldPosition() }
  public getPalmDistanceCm(): number {
    const center = this.leftHand.getPalmCenter()
    return center === null ? -1 : center.distance(this.drawerTransform.getWorldPosition())
  }
  public getCameraFacingDot(): number {
    const position = this.drawerTransform.getWorldPosition()
    const cameraToDrawer = position.sub(this.cameraTransform.getWorldPosition()).normalize()
    return this.drawerTransform.forward.dot(cameraToDrawer)
  }

  private updateAnchor(): void {
    if (!this.active || !this.leftHand.isTracked()) return
    const center = this.leftHand.getPalmCenter()
    if (center === null) return
    const dt = getDeltaTime()
    this.elapsed += dt
    const desired = this.getDesiredPosition(center)
    if (this.elapsed <= this.initialFollowSeconds || desired.distance(this.lockedPosition) >= this.reanchorDistanceCm) {
      this.lockedPosition = desired
    }
    const current = this.drawerTransform.getWorldPosition()
    const alpha = 1 - Math.exp(-this.smoothingRate * dt)
    const next = vec3.lerp(current, this.lockedPosition, alpha)
    this.drawerTransform.setWorldPosition(next)
    this.faceCamera(next)
  }

  private getDesiredPosition(palmCenter: vec3): vec3 {
    const right = this.cameraTransform.right.normalize()
    const up = this.cameraTransform.up.normalize()
    const forward = this.cameraTransform.forward.normalize()
    return palmCenter
      .add(right.uniformScale(-this.outwardCm))
      .add(up.uniformScale(this.upwardCm))
      .add(forward.uniformScale(this.forwardCm))
  }

  private faceCamera(position: vec3): void {
    const cameraToDrawer = position.sub(this.cameraTransform.getWorldPosition()).normalize()
    this.drawerTransform.setWorldRotation(quat.lookAt(cameraToDrawer, vec3.up()))
  }
}
