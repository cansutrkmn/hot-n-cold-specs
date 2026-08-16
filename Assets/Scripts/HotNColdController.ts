import {HotNColdUI} from "./HotNColdUI"
import {ObjectRecognizer} from "./ObjectRecognizer"
import {ObjectLocationResolver} from "./ObjectLocationResolver"
import {SpatialMemoryStore} from "./SpatialMemoryStore"
import {TemperatureGuidance, TemperatureBand} from "./TemperatureGuidance"
import {HotNColdVisualGuidance, HeatTrend} from "./HotNColdVisualGuidance"

type ExperienceState = "READY" | "RECOGNIZING" | "MANUAL_NAME" | "CONFIRM" | "SAVED" | "SEARCHING" | "FOUND"

@component
export class HotNColdController extends BaseScriptComponent {
  @input ui!: HotNColdUI
  @input recognizer!: ObjectRecognizer
  @input locationResolver!: ObjectLocationResolver
  @input memory!: SpatialMemoryStore
  @input guidance!: TemperatureGuidance
  @input visualGuidance!: HotNColdVisualGuidance
  @input previewUseAdversarialPath = false
  @input trackedObject!: SceneObject

  private state: ExperienceState = "READY"
  private candidate = ""
  private proposedTarget: vec3 | null = null
  private happyPathDistances = [320, 200, 100, 40, 8]
  private adversarialPathDistances = [320, 200, 100, 180, 260, 100, 40, 8]
  private mockIndex = 0
  private lastBand = "" as TemperatureBand | ""
  private previewSimulatedUser = vec3.zero()
  private previousDistance: number | null = null

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.ui.onPrimary.add(() => this.handlePrimary())
      this.showReady()
    })
    this.createEvent("UpdateEvent").bind(() => this.updateDeviceGuidance())
  }

  private handlePrimary(): void {
    if (this.state === "READY") { this.beginRecognition(); return }
    if (this.state === "MANUAL_NAME") { this.beginRecognition(); return }
    if (this.state === "CONFIRM") { this.confirmTarget(); return }
    if (this.state === "SAVED") { this.beginSearch(); return }
    if (this.state === "SEARCHING" && global.deviceInfoSystem.isEditor()) { this.advancePreviewGuidance(); return }
    if (this.state === "FOUND") this.showReady()
  }

  private async beginRecognition(): Promise<void> {
    this.state = "RECOGNIZING"
    this.ui.render("Looking…", "", "", false)
    const [recognition, location] = await Promise.all([this.recognizer.recognize(), this.locationResolver.resolveCenterViewTarget()])
    if (!location.success || !location.position) {
      this.state = "READY"
      this.ui.render("Couldn’t find it", "Keep it centered", "Try Again")
      return
    }
    this.proposedTarget = location.position
    if (!recognition.success || !recognition.label) {
      this.state = "MANUAL_NAME"
      this.ui.render("Couldn’t recognize it", "", "Try Again")
      return
    }
    this.candidate = recognition.label
    this.state = "CONFIRM"
    this.ui.render(`${this.candidate}?`, "", "Confirm")
  }

  public submitManualName(name: string): void {
    const clean = name.trim()
    if (this.state !== "MANUAL_NAME" || clean.length === 0 || !this.proposedTarget) return
    this.candidate = clean
    this.state = "CONFIRM"
    this.ui.render(`${this.candidate}?`, "", "Confirm")
  }

  private confirmTarget(): void {
    if (!this.proposedTarget) return
    const cameraPosition = this.trackedObject.getTransform().getWorldPosition()
    this.memory.save(this.candidate, this.proposedTarget)
    this.locationResolver.hideMarker()
    print(`[HotNCold][Proof] saved target=${this.format(this.proposedTarget)} cm camera=${this.format(cameraPosition)} cm`)
    this.state = "SAVED"
    this.ui.render("REMEMBERED", "", `Find ${this.candidate}`)
  }

  private beginSearch(): void {
    this.state = "SEARCHING"; this.mockIndex = 0; this.lastBand = ""; this.previousDistance = null
    if (global.deviceInfoSystem.isEditor()) this.simulatePreviewDistance(this.previewDistances()[0])
    else this.ui.render("SEARCHING", "", "", false)
  }

  private advancePreviewGuidance(): void {
    const distances = this.previewDistances()
    this.mockIndex = Math.min(this.mockIndex + 1, distances.length - 1)
    this.simulatePreviewDistance(distances[this.mockIndex])
  }

  private updateDeviceGuidance(): void {
    if (this.state !== "SEARCHING" || global.deviceInfoSystem.isEditor()) return
    const target = this.memory.getPosition(); if (!target) return
    const current = this.trackedObject.getTransform().getWorldPosition()
    const distance = current.distance(target)
    const band = this.guidance.classify(distance)
    if (band !== this.lastBand) this.showBand(band, distance)
  }

  private showBand(band: TemperatureBand, distance: number): void {
    const trend = this.getTrend(distance)
    const heat = this.guidance.normalizedHeat(distance)
    this.lastBand = band
    print(`[HotNCold][Guidance] ${band} heat=${heat.toFixed(2)} trend=${trend} at ${distance.toFixed(0)} cm`)
    print(`[HotNCold][TrendTest] ${band === "FOUND" ? "FOUND" : trend}`)
    this.visualGuidance.setGuidance(band, heat, trend)
    if (band === "FOUND") {
      this.state = "FOUND"
      if (this.proposedTarget) {
        this.locationResolver.showSavedMarker(this.proposedTarget)
        setTimeout(() => this.locationResolver.hideMarker(), 5000)
      }
      this.ui.render("FOUND!", "", "Remember This")
    } else {
      const trendCopy = trend === "WARMER" ? "Getting warmer" : trend === "COLDER" ? "Getting colder" : "Explore and feel the temperature change"
      this.ui.render(band, trendCopy, global.deviceInfoSystem.isEditor() ? "Preview Step" : "", global.deviceInfoSystem.isEditor())
    }
    this.previousDistance = distance
  }

  private showReady(): void {
    this.state = "READY"; this.candidate = ""; this.proposedTarget = null; this.lastBand = ""
    this.locationResolver.hideMarker()
    this.visualGuidance.hide()
    this.ui.render("HOT N COLD", "", "Remember This")
  }

  private simulatePreviewDistance(distanceCm: number): void {
    const target = this.memory.getPosition(); if (!target) return
    this.previewSimulatedUser = target.add(new vec3(distanceCm, 0, 0))
    const actualDistance = this.previewSimulatedUser.distance(target)
    print(`[HotNCold][PreviewUser] simulated=${this.format(this.previewSimulatedUser)} target=${this.format(target)} distance=${actualDistance.toFixed(0)} cm`)
    this.showBand(this.guidance.classify(actualDistance), actualDistance)
  }

  private format(value: vec3): string { return `(${value.x.toFixed(1)}, ${value.y.toFixed(1)}, ${value.z.toFixed(1)})` }

  private getTrend(distance: number): HeatTrend {
    if (this.previousDistance === null) return "START"
    const delta = distance - this.previousDistance
    if (delta < -2) return "WARMER"
    if (delta > 2) return "COLDER"
    return "STEADY"
  }

  private previewDistances(): number[] { return this.previewUseAdversarialPath ? this.adversarialPathDistances : this.happyPathDistances }
}
