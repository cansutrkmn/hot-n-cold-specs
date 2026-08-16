export interface SpatialMemoryRecord {
  label: string
  position: vec3
  anchorIdentifier: string | null
  anchorReference: unknown | null
}

@component
export class SpatialMemoryStore extends BaseScriptComponent {
  private record: SpatialMemoryRecord | null = null

  public save(label: string, position: vec3, anchorIdentifier: string | null = null, anchorReference: unknown | null = null): void {
    this.record = {label, position: new vec3(position.x, position.y, position.z), anchorIdentifier, anchorReference}
    print(`[HotNCold][Memory] saved ${label} at ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)} cm`)
  }

  // WorldAnchor-ready boundary. The Anchors package can populate identifier/reference on device;
  // position remains available for current-session guidance and Preview verification.
  public attachAnchor(anchorIdentifier: string, anchorReference: unknown): void {
    if (!this.record) return
    this.record.anchorIdentifier = anchorIdentifier
    this.record.anchorReference = anchorReference
  }

  public hasTarget(): boolean { return this.record !== null }
  public getLabel(): string { return this.record?.label ?? "" }
  public getPosition(): vec3 | null { return this.record?.position ?? null }
  public getRecord(): SpatialMemoryRecord | null { return this.record }
}
