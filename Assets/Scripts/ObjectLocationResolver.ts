export interface LocationResolution {
  success: boolean
  position?: vec3
  normal?: vec3
  source: "preview-debug-target" | "world-query" | "world-query-failure"
  error?: string
}

@component
export class ObjectLocationResolver extends BaseScriptComponent {
  @input cameraObject!: SceneObject
  @input targetMarker!: SceneObject
  @input previewDebugTarget = new vec3(32, -18, -180)
  @input maxRayDistanceCm = 500

  private hitSession: HitTestSession | null = null

  onAwake(): void {
    this.buildMarker()
    this.targetMarker.enabled = false
    if (!global.deviceInfoSystem.isEditor()) {
      const worldQuery = require("LensStudio:WorldQueryModule") as WorldQueryModule
      const options = HitTestSessionOptions.create()
      options.filter = true
      this.hitSession = worldQuery.createHitTestSessionWithOptions(options)
      this.hitSession.start()
    }
    this.createEvent("OnDestroyEvent").bind(() => this.hitSession?.stop())
  }

  public resolveCenterViewTarget(): Promise<LocationResolution> {
    if (global.deviceInfoSystem.isEditor()) {
      const point = new vec3(this.previewDebugTarget.x, this.previewDebugTarget.y, this.previewDebugTarget.z)
      this.showMarker(point)
      print(`[HotNCold][Location] Preview debug target resolved at ${this.format(point)} cm`)
      return Promise.resolve({success: true, position: point, normal: vec3.up(), source: "preview-debug-target"})
    }

    if (!this.hitSession) return Promise.resolve({success: false, source: "world-query-failure", error: "WorldQuery session unavailable"})
    const transform = this.cameraObject.getTransform()
    const rayStart = transform.getWorldPosition()
    const rayEnd = rayStart.add(transform.forward.uniformScale(this.maxRayDistanceCm))
    return new Promise<LocationResolution>((resolve) => {
      this.hitSession!.hitTest(rayStart, rayEnd, (hit: WorldQueryHitTestResult | null) => {
        if (!hit) {
          this.targetMarker.enabled = false
          resolve({success: false, source: "world-query-failure", error: "No center-view surface hit"})
          return
        }
        this.showMarker(hit.position)
        print(`[HotNCold][Location] WorldQuery target resolved at ${this.format(hit.position)} cm`)
        resolve({success: true, position: hit.position, normal: hit.normal, source: "world-query"})
      })
    })
  }

  public hideMarker(): void { this.targetMarker.enabled = false }
  public showSavedMarker(position: vec3): void { this.showMarker(position) }

  private showMarker(position: vec3): void {
    this.targetMarker.getTransform().setWorldPosition(position)
    this.targetMarker.enabled = true
  }

  private buildMarker(): void {
    this.targetMarker.createComponent("Component.Canvas")
    const text = this.targetMarker.createComponent("Component.Text") as Text
    text.text = "◎  TARGET"
    text.size = 64
    text.textFill.color = new vec4(1, 0.75, 0.15, 1)
    text.depthTest = true
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Overflow
    text.verticalOverflow = VerticalOverflow.Overflow
    text.layoutRect = Rect.create(-8, 8, -2, 2)
  }

  private format(value: vec3): string { return `(${value.x.toFixed(1)}, ${value.y.toFixed(1)}, ${value.z.toFixed(1)})` }
}
