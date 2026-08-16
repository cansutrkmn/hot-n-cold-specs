import {CaptureIntent} from "./CaptureIntent"

export interface LocationResolution {
  success: boolean
  position?: vec3
  normal?: vec3
  source: "preview-world-query" | "device-world-query" | "world-query-failure"
  error?: string
}

type MarkerMode = "HIDDEN" | "CONFIRM" | "FOUND"

@component
export class ObjectLocationResolver extends BaseScriptComponent {
  @input deviceTracking!: DeviceTracking
  @input targetMarker!: SceneObject
  @input markerMesh!: RenderMesh
  @input markerMaterial!: Material
  @input maxRayDistanceCm = 500

  private hitSession: HitTestSession | null = null
  private beads: {object: SceneObject; material: Material; phase: number}[] = []
  private labelText!: Text
  private markerMode: MarkerMode = "HIDDEN"
  private elapsed = 0
  private reveal = 0

  onAwake(): void {
    this.buildMarker()
    this.targetMarker.enabled = false
    const worldQuery = require("LensStudio:WorldQueryModule") as WorldQueryModule
    const options = HitTestSessionOptions.create()
    options.filter = true
    this.hitSession = worldQuery.createHitTestSessionWithOptions(options)
    this.hitSession.start()
    if (this.deviceTracking?.worldOptions) {
      this.deviceTracking.worldOptions.enableWorldMeshesTracking = true
    }
    this.createEvent("UpdateEvent").bind(() => this.updateMarker())
    this.createEvent("OnDestroyEvent").bind(() => this.hitSession?.stop())
  }

  public resolveCenterViewTarget(intent: CaptureIntent): Promise<LocationResolution> {
    if (!this.hitSession) return Promise.resolve({success: false, source: "world-query-failure", error: "WorldQuery session unavailable"})
    const rayStart = intent.origin
    const rayEnd = rayStart.add(intent.direction.uniformScale(this.maxRayDistanceCm))
    return new Promise<LocationResolution>((resolve) => {
      this.hitSession!.hitTest(rayStart, rayEnd, (hit: WorldQueryHitTestResult | null) => {
        if (!hit) {
          const meshHits = this.deviceTracking?.raycastWorldMesh(rayStart, rayEnd) || []
          if (meshHits.length > 0) {
            const meshHit = meshHits[0]
            const source = global.deviceInfoSystem.isEditor() ? "preview-world-query" : "device-world-query"
            print(`[HotNCold][Location] ${source} world-mesh fallback at ${this.format(meshHit.position)} cm`)
            resolve({success: true, position: meshHit.position, normal: meshHit.normal, source})
            return
          }
          this.hideMarker()
          print("[HotNCold][Location] no center-view surface or world-mesh hit")
          resolve({success: false, source: "world-query-failure", error: "No center-view surface hit"})
          return
        }
        const source = global.deviceInfoSystem.isEditor() ? "preview-world-query" : "device-world-query"
        print(`[HotNCold][Location] ${source} target resolved at ${this.format(hit.position)} cm`)
        resolve({success: true, position: hit.position, normal: hit.normal, source})
      })
    })
  }

  public resolveImagePoint(intent: CaptureIntent, centerX: number, centerY: number, tag: string = "bbox"): Promise<LocationResolution> {
    if (!this.hitSession) return Promise.resolve({success: false, source: "world-query-failure", error: "WorldQuery session unavailable"})
    const camera = global.deviceInfoSystem.getTrackingCameraForId(intent.cameraId)
    if (!camera || !isFinite(centerX) || !isFinite(centerY) || centerX < 0 || centerX > 1 || centerY < 0 || centerY > 1) {
      return Promise.resolve({success: false, source: "world-query-failure", error: "Invalid camera or image point"})
    }
    const nearDevice = camera.unproject(new vec2(centerX, centerY), 5)
    const farDevice = camera.unproject(new vec2(centerX, centerY), this.maxRayDistanceCm)
    const nearWorld = intent.toWorldTrackingOriginFromDeviceRef.multiplyPoint(nearDevice)
    const farWorld = intent.toWorldTrackingOriginFromDeviceRef.multiplyPoint(farDevice)
    print(`[HotNCold][ImageRay][${tag}] p=(${centerX.toFixed(4)}, ${centerY.toFixed(4)}) nearDevice=${this.format(nearDevice)} farDevice=${this.format(farDevice)} nearWorld=${this.format(nearWorld)} farWorld=${this.format(farWorld)}`)
    return new Promise<LocationResolution>((resolve) => {
      this.hitSession!.hitTest(nearWorld, farWorld, (hit: WorldQueryHitTestResult | null) => {
        if (!hit) {
          const meshHits = this.deviceTracking?.raycastWorldMesh(nearWorld, farWorld) || []
          if (meshHits.length > 0) {
            const meshHit = meshHits[0]
            const source = global.deviceInfoSystem.isEditor() ? "preview-world-query" : "device-world-query"
            print(`[HotNCold][ImageRay][${tag}] world-mesh hit=${this.format(meshHit.position)} normal=${this.format(meshHit.normal)}`)
            resolve({success: true, position: meshHit.position, normal: meshHit.normal, source})
            return
          }
          print(`[HotNCold][ImageRay][${tag}] no WorldQuery or world-mesh hit`)
          resolve({success: false, source: "world-query-failure", error: "No image-ray surface hit"})
          return
        }
        const source = global.deviceInfoSystem.isEditor() ? "preview-world-query" : "device-world-query"
        print(`[HotNCold][ImageRay][${tag}] ${source} hit=${this.format(hit.position)} normal=${this.format(hit.normal)}`)
        resolve({success: true, position: hit.position, normal: hit.normal, source})
      })
    })
  }

  public showProposedMarker(position: vec3, label: string): void {
    this.showMarker(position, `${label}?`, "CONFIRM")
  }

  public hideMarker(): void {
    this.markerMode = "HIDDEN"
    this.targetMarker.enabled = false
  }

  public showSavedMarker(position: vec3, label: string = "FOUND"): void {
    this.showMarker(position, `There it is\n${this.titleCase(label)}`, "FOUND")
  }

  private showMarker(position: vec3, label: string, mode: MarkerMode): void {
    this.targetMarker.getTransform().setWorldPosition(position)
    this.labelText.text = label
    this.markerMode = mode
    this.elapsed = 0
    this.reveal = 0
    this.targetMarker.enabled = true
  }

  private buildMarker(): void {
    this.targetMarker.createComponent("Component.Canvas")
    const labelObject = global.scene.createSceneObject("Remembered Object Label")
    labelObject.setParent(this.targetMarker)
    labelObject.getTransform().setLocalPosition(new vec3(0, 8.5, 0))
    this.labelText = labelObject.createComponent("Component.Text") as Text
    this.labelText.text = ""
    this.labelText.size = 40
    this.labelText.textFill.color = new vec4(1, 0.9, 0.55, 1)
    this.labelText.depthTest = true
    this.labelText.horizontalAlignment = HorizontalAlignment.Center
    this.labelText.verticalAlignment = VerticalAlignment.Center
    this.labelText.horizontalOverflow = HorizontalOverflow.Overflow
    this.labelText.verticalOverflow = VerticalOverflow.Overflow
    this.labelText.layoutRect = Rect.create(-8, 8, -3.2, 3.2)

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const bead = global.scene.createSceneObject(`Target Halo ${i}`)
      bead.setParent(this.targetMarker)
      bead.getTransform().setLocalPosition(new vec3(Math.cos(angle) * 5.5, Math.sin(angle) * 5.5, 0))
      const visual = bead.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mesh = this.markerMesh
      const material = this.markerMaterial.clone()
      visual.mainMaterial = material
      this.beads.push({object: bead, material, phase: angle})
    }
  }

  private updateMarker(): void {
    if (this.markerMode === "HIDDEN") return
    this.elapsed += getDeltaTime()
    this.reveal += (1 - this.reveal) * Math.min(1, getDeltaTime() * 7)
    const found = this.markerMode === "FOUND"
    const speed = found ? 7 : 2.1
    const baseColor = found ? new vec3(1, 0.12, 0.03) : new vec3(0.2, 0.92, 1)
    for (const bead of this.beads) {
      const wave = 0.5 + 0.5 * Math.sin(this.elapsed * speed + bead.phase * 2)
      const radius = (found ? 7.2 : 5.5) * this.reveal
      bead.object.getTransform().setLocalPosition(new vec3(Math.cos(bead.phase) * radius, Math.sin(bead.phase) * radius, 0))
      const scale = (found ? 0.78 : 0.48) * (0.82 + wave * (found ? 0.7 : 0.25)) * this.reveal
      bead.object.getTransform().setLocalScale(new vec3(scale * 1.45, scale * 0.34, scale * 0.22))
      bead.object.getTransform().setLocalRotation(quat.angleAxis(bead.phase + Math.PI * 0.5, vec3.forward()))
      const brightness = 0.55 + wave * 0.45
      bead.material.mainPass.baseColor = new vec4(baseColor.x * brightness, baseColor.y * brightness, baseColor.z * brightness, 1)
    }
    const labelAlpha = Math.max(0, Math.min(1, (this.reveal - 0.25) * 1.34))
    this.labelText.textFill.color = new vec4(found ? 1 : 0.72, found ? 0.78 : 0.95, found ? 0.45 : 1, labelAlpha)
    const labelScale = 0.9 + labelAlpha * 0.1
    this.labelText.getSceneObject().getTransform().setLocalScale(new vec3(labelScale, labelScale, labelScale))
  }

  private format(value: vec3): string { return `(${value.x.toFixed(1)}, ${value.y.toFixed(1)}, ${value.z.toFixed(1)})` }

  private titleCase(value: string): string {
    return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value
  }
}
