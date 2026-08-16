import {HotNColdUI} from "./HotNColdUI"
import {ObjectRecognizer} from "./ObjectRecognizer"
import {ObjectLocationResolver} from "./ObjectLocationResolver"
import {SpatialMemoryStore, SpatialMemory} from "./SpatialMemoryStore"
import {MemoryDrawer} from "./MemoryDrawer"
import {TemperatureGuidance, TemperatureBand} from "./TemperatureGuidance"
import {ThermalTrailGuidance, HeatTrend} from "./ThermalTrailGuidance"
import {CaptureIntentProvider} from "./CaptureIntentProvider"

type ExperienceState = "READY" | "RECOGNIZING" | "MANUAL_NAME" | "CONFIRM" | "SAVED" | "MEMORIES" | "SEARCHING" | "FOUND"

@component
export class HotNColdController extends BaseScriptComponent {
  @input ui!: HotNColdUI
  @input recognizer!: ObjectRecognizer
  @input captureProvider!: CaptureIntentProvider
  @input locationResolver!: ObjectLocationResolver
  @input memory!: SpatialMemoryStore
  @input memoryDrawer!: MemoryDrawer
  @input guidance!: TemperatureGuidance
  @input trailGuidance!: ThermalTrailGuidance
  @input trackedObject!: SceneObject

  private state: ExperienceState = "READY"
  private candidate = ""
  private proposedTarget: vec3 | null = null
  private proposedNormal = vec3.up()
  private lastBand = "" as TemperatureBand | ""
  private previousDistance: number | null = null
  private currentTrend: HeatTrend = "START"
  private trendSampleTime = 0
  private lastPrimaryAt = -1
  private arrivalDwell = 0
  private activeSearchMemory: SpatialMemory | null = null
  private arrivalDwell = 0
  private readonly arrivalRadiusCm = 70
  private readonly arrivalViewDot = 0.72
  private readonly arrivalDwellSeconds = 0.4

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.ui.onPrimary.add(() => this.handlePrimary())
      this.ui.onMemories.add(() => this.openMemories())
      this.memoryDrawer.onSelected.add((id: string) => this.selectMemory(id))
      this.memoryDrawer.onClosed.add(() => {
        if (this.state === "MEMORIES") this.showReady()
      })
      this.showReady()
    })
    this.createEvent("UpdateEvent").bind(() => this.updateGuidance())
  }

  private handlePrimary(): void {
    const now = getTime()
    if (this.lastPrimaryAt >= 0 && now - this.lastPrimaryAt < 0.45) return
    this.lastPrimaryAt = now
    if (this.state === "READY") { this.beginRecognition(); return }
    if (this.state === "MANUAL_NAME") { this.beginRecognition(); return }
    if (this.state === "CONFIRM") { this.confirmTarget(); return }
    if (this.state === "FOUND") this.showReady()
  }

  private async beginRecognition(): Promise<void> {
    this.state = "RECOGNIZING"
    this.ui.setMemoriesVisible(false)
    this.ui.render("Reading the room…", "", "", false)
    const intent = this.captureProvider.capture()
    const recognition = await this.recognizer.recognize(intent)
    if (!recognition.success || !recognition.label) {
      this.state = "MANUAL_NAME"
      this.ui.render("Nothing clear yet", "", "Look Again")
      return
    }
    if (recognition.centerX === undefined || recognition.centerY === undefined) {
      this.state = "READY"
      this.ui.render("Center an object", "", "Look Again")
      return
    }
    const location = await this.locationResolver.resolveImagePoint(intent, recognition.centerX, recognition.centerY, "save")
    if (!location.success || !location.position) {
      this.state = "READY"
      this.ui.render("No surface found", "", "Look Again")
      return
    }
    this.proposedTarget = location.position
    this.proposedNormal = location.normal || vec3.up()
    this.candidate = recognition.label
    this.state = "CONFIRM"
    this.locationResolver.showProposedMarker(this.proposedTarget, this.candidate)
    this.ui.render("", "", "Remember It")
  }

  public submitManualName(name: string): void {
    const clean = name.trim()
    if (this.state !== "MANUAL_NAME" || clean.length === 0 || !this.proposedTarget) return
    this.candidate = clean
    this.state = "CONFIRM"
    this.locationResolver.showProposedMarker(this.proposedTarget, this.candidate)
    this.ui.render("", "", "Confirm")
  }

  private confirmTarget(): void {
    if (!this.proposedTarget) return
    const cameraPosition = this.trackedObject.getTransform().getWorldPosition()
    const memory = this.memory.addOrUpdate(this.candidate, this.proposedTarget, this.proposedNormal)
    this.locationResolver.hideMarker()
    print(`[HotNCold][Proof] saved target=${this.format(this.proposedTarget)} cm camera=${this.format(cameraPosition)} cm`)
    this.state = "SAVED"
    this.ui.render("Remembered", this.candidate, "", false)
    print(`[HotNCold][Memory] active candidate stored id=${memory.id}`)
    setTimeout(() => {
      if (this.state === "SAVED") this.showReady()
    }, 1450)
  }

  private beginSearch(memory: SpatialMemory): void {
    const target = memory.position
    this.activeSearchMemory = memory
    this.state = "SEARCHING"
    this.lastBand = ""
    this.previousDistance = null
    this.currentTrend = "START"
    this.trendSampleTime = 0
    this.arrivalDwell = 0
    this.locationResolver.hideMarker()
    this.ui.render("", "", "", false)
    this.trailGuidance.begin(target, memory.normal)
    this.ui.render("Look around — follow the crystal trail.", "", "", false)
    this.updateGuidance(true)
  }

  private updateGuidance(force: boolean = false): void {
    if (this.state !== "SEARCHING") return
  const transform = this.trackedObject.getTransform()
  const current = transform.getWorldPosition()
  const offset = target.sub(current)
  const distance = offset.length
  const forward = transform.getWorldTransform().multiplyDirection(new vec3(0, 0, -1)).normalize()
  const viewDot = distance > 0.001 ? forward.dot(offset.normalize()) : 1

  if (distance <= this.arrivalRadiusCm && viewDot >= this.arrivalViewDot) {
    this.arrivalDwell += getDeltaTime()
  } else {
    this.arrivalDwell = Math.max(0, this.arrivalDwell - getDeltaTime() * 2)
  }

  this.processDistance(
    distance,
    force,
    this.arrivalDwell >= this.arrivalDwellSeconds
  )
    this.processDistance(distance, force, this.arrivalDwell >= this.arrivalDwellSeconds)
  }

  private processDistance(distance: number, force: boolean = false, arrived: boolean = false): void {
    const classified = this.guidance.classify(distance)
    const band: TemperatureBand = !arrived && classified === "FOUND" ? "HOT" : classified
    const heat = this.guidance.normalizedHeat(distance)
    this.trendSampleTime += getDeltaTime()
    let trendChanged = false
    if (force || this.previousDistance === null || this.trendSampleTime >= 0.35) {
      const nextTrend = this.getTrend(distance)
      trendChanged = nextTrend !== this.currentTrend && nextTrend !== "STEADY"
      this.currentTrend = nextTrend === "STEADY" ? this.currentTrend : nextTrend
      this.previousDistance = distance
      this.trendSampleTime = 0
    }

    this.trailGuidance.setGuidance(band, heat, this.currentTrend)
    if (arrived) {
      this.completeFound(distance, heat)
      return
    }

    const bandChanged = band !== this.lastBand
    if (force || bandChanged || trendChanged) {
      print(`[HotNCold][Guidance] ${band} heat=${heat.toFixed(2)} trend=${this.currentTrend} at ${distance.toFixed(0)} cm`)
      print(`[HotNCold][TrendTest] ${this.currentTrend}`)
    }
    this.lastBand = band
  }

  private completeFound(distance: number, heat: number): void {
    if (this.state === "FOUND") return
    this.state = "FOUND"
    this.lastBand = "FOUND"
    if (this.activeSearchMemory) {
      this.locationResolver.showSavedMarker(this.activeSearchMemory.position, this.activeSearchMemory.label)
      setTimeout(() => this.locationResolver.hideMarker(), 2200)
    }
    this.trailGuidance.setGuidance("FOUND", heat, "WARMER")
    this.trailGuidance.showFound()
    this.ui.render("", "", "Remember Another")
    print(`[HotNCold][Guidance] FOUND heat=${heat.toFixed(2)} trend=FOUND at ${distance.toFixed(0)} cm`)
    print("[HotNCold][TrendTest] FOUND")
  }

  // Hidden Editor-only deterministic test boundary. It is never exposed as release UI.
  public debugPreviewDistance(distanceCm: number): void {
    if (!global.deviceInfoSystem.isEditor() || this.state !== "SEARCHING") return
    print(`[HotNCold][PreviewTest] injected distance=${distanceCm.toFixed(0)} cm`)
    this.processDistance(distanceCm, true)
  }

  public requestMemoryDrawerOpen(): boolean {
    if (this.state !== "READY") return false
    this.openMemories()
    return true
  }

  public requestMemoryDrawerClose(): boolean {
    if (this.state !== "MEMORIES") return false
    this.memoryDrawer.close(true)
    return true
  }

  public isMemoryDrawerOpen(): boolean {
    return this.state === "MEMORIES" && this.memoryDrawer.isOpen()
  }

  private showReady(): void {
    this.state = "READY"
    this.candidate = ""
    this.proposedTarget = null
    this.lastBand = ""
    this.activeSearchMemory = null
    this.locationResolver.hideMarker()
    this.trailGuidance.hide()
    this.ui.render("HOT N COLD", "", "Remember This")
    this.ui.setMemoriesVisible(true)
  }

  private openMemories(): void {
    if (this.state !== "READY") return
    this.state = "MEMORIES"
    this.ui.render("", "", "", false)
    this.ui.hideAllControls()
    this.memoryDrawer.open()
  }

  private selectMemory(id: string): void {
    if (this.state !== "MEMORIES") return
    const memory = this.memory.getById(id)
    if (!memory) {
      this.memoryDrawer.close(false)
      this.showReady()
      return
    }
    this.memoryDrawer.close(false)
    this.candidate = memory.label
    this.proposedTarget = new vec3(memory.position.x, memory.position.y, memory.position.z)
    this.proposedNormal = new vec3(memory.normal.x, memory.normal.y, memory.normal.z)
    this.beginSearch(memory)
  }

  private format(value: vec3): string { return `(${value.x.toFixed(1)}, ${value.y.toFixed(1)}, ${value.z.toFixed(1)})` }

  private getTrend(distance: number): HeatTrend {
    if (this.previousDistance === null) return "START"
    const delta = distance - this.previousDistance
    if (delta < -3) return "WARMER"
    if (delta > 3) return "COLDER"
    return "STEADY"
  }
}
