import {TemperatureBand} from "./TemperatureGuidance"
export type HeatTrend = "START" | "WARMER" | "COLDER" | "STEADY"
interface OrbVisual { object: SceneObject; material: Material; basePosition: vec3; baseScale: number; phase: number }

@component
export class HotNColdVisualGuidance extends BaseScriptComponent {
  private orbs: OrbVisual[] = []
  private currentHeat = 0
  private targetHeat = 0
  private active = false
  private foundBurst = false
  private elapsed = 0

  onAwake(): void {
    for (let i = 0; i < this.sceneObject.getChildrenCount(); i++) {
      const child = this.sceneObject.getChild(i)
      const visual = child.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (!visual) continue
      const material = visual.mainMaterial.clone()
      visual.mainMaterial = material
      this.orbs.push({object: child, material, basePosition: child.getTransform().getLocalPosition(), baseScale: child.name.indexOf("Accent") >= 0 ? 1.45 : 0.42, phase: i * 0.73})
    }
    this.setVisible(false)
    this.createEvent("UpdateEvent").bind(() => this.updateVisuals())
  }

  public setGuidance(band: TemperatureBand, normalizedHeat: number, _trend: HeatTrend): void {
    this.targetHeat = Math.max(0, Math.min(1, normalizedHeat))
    this.foundBurst = band === "FOUND"
    this.setVisible(true)
  }
  public hide(): void { this.setVisible(false) }

  private updateVisuals(): void {
    if (!this.active) return
    const dt = getDeltaTime(); this.elapsed += dt
    this.currentHeat += (this.targetHeat - this.currentHeat) * Math.min(1, dt * 4)
    const color = this.heatColor(this.currentHeat)
    const frequency = 0.45 + this.currentHeat * 2.8
    const burst = this.foundBurst ? 1.5 : 1
    const pulse = 0.88 + (0.12 + this.currentHeat * 0.2) * (0.5 + 0.5 * Math.sin(this.elapsed * frequency * Math.PI * 2))
    for (const orb of this.orbs) {
      const wave = Math.sin(this.elapsed * (0.4 + this.currentHeat * 1.7) + orb.phase)
      orb.object.getTransform().setLocalPosition(orb.basePosition.add(new vec3(0, wave * (0.25 + this.currentHeat * 0.9), 0)))
      const scale = orb.baseScale * pulse * burst * (1 + wave * 0.06)
      orb.object.getTransform().setLocalScale(new vec3(scale, scale, Math.max(0.16, scale * 0.28)))
      const brightness = orb.baseScale > 1 ? 0.68 + this.currentHeat * 0.3 : 0.42 + this.currentHeat * 0.55
      orb.material.mainPass.baseColor = new vec4(color.x * brightness, color.y * brightness, color.z * brightness, 1)
    }
  }

  private heatColor(heat: number): vec3 {
    const cold = new vec3(0.12, 0.48, 1), cyan = new vec3(0.08, 0.92, 1), warm = new vec3(1, 0.62, 0.05), hot = new vec3(1, 0.04, 0.02)
    if (heat < 0.33) return vec3.lerp(cold, cyan, heat / 0.33)
    if (heat < 0.66) return vec3.lerp(cyan, warm, (heat - 0.33) / 0.33)
    return vec3.lerp(warm, hot, (heat - 0.66) / 0.34)
  }
  private setVisible(visible: boolean): void { this.active = visible; for (const orb of this.orbs) orb.object.enabled = visible }
}
