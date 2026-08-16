import {TemperatureBand} from "./TemperatureGuidance"
export type HeatTrend = "START" | "WARMER" | "COLDER" | "STEADY"
interface OrbVisual { object: SceneObject; material: Material; basePosition: vec3; baseScale: number; phase: number; accent: boolean }

@component
export class HotNColdVisualGuidance extends BaseScriptComponent {
  private orbs: OrbVisual[] = []
  private currentHeat = 0
  private targetHeat = 0
  private active = false
  private foundBurst = false
  private elapsed = 0
  private trend: HeatTrend = "START"

  onAwake(): void {
    for (let i = 0; i < this.sceneObject.getChildrenCount(); i++) {
      const child = this.sceneObject.getChild(i)
      const visual = child.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (!visual) continue
      const material = visual.mainMaterial.clone()
      visual.mainMaterial = material
      const accent = child.name.indexOf("Accent") >= 0
      this.orbs.push({object: child, material, basePosition: child.getTransform().getLocalPosition(), baseScale: accent ? 1.15 : 0.34, phase: i * 0.73, accent})
    }
    this.setVisible(false)
    this.createEvent("UpdateEvent").bind(() => this.updateVisuals())
  }

  public setGuidance(band: TemperatureBand, normalizedHeat: number, trend: HeatTrend): void {
    this.targetHeat = Math.max(0, Math.min(1, normalizedHeat))
    this.foundBurst = band === "FOUND"
    this.trend = trend
    this.setVisible(true)
  }

  public hide(): void {
    this.foundBurst = false
    this.setVisible(false)
  }

  private updateVisuals(): void {
    if (!this.active) return
    const dt = getDeltaTime()
    this.elapsed += dt
    this.currentHeat += (this.targetHeat - this.currentHeat) * Math.min(1, dt * 3.2)
    const color = this.heatColor(this.currentHeat)
    const frequency = 0.32 + this.currentHeat * 3.4
    const trendEnergy = this.trend === "WARMER" ? 1.18 : this.trend === "COLDER" ? 0.82 : 1
    const burst = this.foundBurst ? 1.8 : 1
    const pulse = 0.84 + (0.1 + this.currentHeat * 0.24) * (0.5 + 0.5 * Math.sin(this.elapsed * frequency * Math.PI * 2))

    for (const orb of this.orbs) {
      const wave = Math.sin(this.elapsed * (0.25 + this.currentHeat * 2.2) * trendEnergy + orb.phase)
      const radial = orb.basePosition.normalize().uniformScale(wave * (0.25 + this.currentHeat * 1.3))
      const drift = new vec3(radial.x, wave * (0.18 + this.currentHeat * 0.75), 0)
      orb.object.getTransform().setLocalPosition(orb.basePosition.add(drift))
      const scale = orb.baseScale * pulse * burst * (1 + wave * 0.08)
      orb.object.getTransform().setLocalScale(new vec3(scale, scale, Math.max(0.12, scale * 0.24)))
      const alphaLikeBrightness = orb.accent ? 0.42 + this.currentHeat * 0.42 : 0.22 + this.currentHeat * 0.58
      orb.material.mainPass.baseColor = new vec4(color.x * alphaLikeBrightness, color.y * alphaLikeBrightness, color.z * alphaLikeBrightness, 1)
    }
  }

  private heatColor(heat: number): vec3 {
    const cold = new vec3(0.08, 0.38, 1)
    const cyan = new vec3(0.05, 0.92, 1)
    const warm = new vec3(1, 0.58, 0.04)
    const hot = new vec3(1, 0.025, 0.01)
    if (heat < 0.33) return vec3.lerp(cold, cyan, heat / 0.33)
    if (heat < 0.66) return vec3.lerp(cyan, warm, (heat - 0.33) / 0.33)
    return vec3.lerp(warm, hot, (heat - 0.66) / 0.34)
  }

  private setVisible(visible: boolean): void {
    this.active = visible
    for (const orb of this.orbs) orb.object.enabled = visible
  }
}
