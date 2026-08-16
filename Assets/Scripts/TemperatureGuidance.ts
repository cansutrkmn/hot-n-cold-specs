export type TemperatureBand = "COLD" | "COOL" | "WARM" | "HOT" | "FOUND"

@component
export class TemperatureGuidance extends BaseScriptComponent {
  @input coldThresholdCm = 250
  @input coolThresholdCm = 140
  @input warmThresholdCm = 70
  @input foundThresholdCm = 18

  public classify(distanceCm: number): TemperatureBand {
    if (distanceCm <= this.foundThresholdCm) return "FOUND"
    if (distanceCm <= this.warmThresholdCm) return "HOT"
    if (distanceCm <= this.coolThresholdCm) return "WARM"
    if (distanceCm <= this.coldThresholdCm) return "COOL"
    return "COLD"
  }

  public normalizedHeat(distanceCm: number): number {
    const span = Math.max(1, this.coldThresholdCm - this.foundThresholdCm)
    return Math.max(0, Math.min(1, 1 - (distanceCm - this.foundThresholdCm) / span))
  }
}
