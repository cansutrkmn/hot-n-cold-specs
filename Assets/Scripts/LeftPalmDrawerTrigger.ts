import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import TrackedHand from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand"
import {HotNColdController} from "./HotNColdController"
import {PalmRelativeDrawerAnchor} from "./PalmRelativeDrawerAnchor"

@component
export class LeftPalmDrawerTrigger extends BaseScriptComponent {
  @input controller!: HotNColdController
  @input drawerAnchor!: PalmRelativeDrawerAnchor

  public openRequestCount = 0
  public closeRequestCount = 0

  private leftHand!: TrackedHand
  private presentationDwell = 0
  private releaseDwell = 0
  private openedByPalm = false
  private readonly presentationDwellSeconds = 0.4
  private readonly releaseDwellSeconds = 0.15

  onAwake(): void {
    this.leftHand = SIK.HandInputData.getHand("left")
    this.createEvent("UpdateEvent").bind(() => this.updatePalm())
  }

  public resetTestCounters(): void {
    this.openRequestCount = 0
    this.closeRequestCount = 0
  }

  private updatePalm(): void {
    const presented = this.leftHand.isTracked() && this.leftHand.isFacingCamera()
    const dt = getDeltaTime()
    if (presented) {
      this.releaseDwell = 0
      this.presentationDwell += dt
      if (!this.openedByPalm && this.presentationDwell >= this.presentationDwellSeconds) {
        if (this.controller.requestMemoryDrawerOpen()) {
          this.drawerAnchor.beginPalmPlacement()
          this.openedByPalm = true
          this.openRequestCount++
          print("[HotNCold][Palm] LEFT_PALM_PRESENTED drawer=open")
        }
      }
      return
    }

    this.presentationDwell = 0
    if (!this.openedByPalm) return
    this.releaseDwell += dt
    if (this.releaseDwell < this.releaseDwellSeconds) return
    if (this.controller.requestMemoryDrawerClose()) {
      this.drawerAnchor.endPalmPlacement()
      this.closeRequestCount++
      print("[HotNCold][Palm] LEFT_PALM_RELEASED drawer=closed")
    }
    this.openedByPalm = false
    this.releaseDwell = 0
  }
}
