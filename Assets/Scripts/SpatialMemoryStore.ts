export interface SpatialMemory {
  id: string
  label: string
  position: vec3
  normal: vec3
  savedAtSeconds: number
  anchorIdentifier?: string | null
  anchorReference?: unknown | null
}

@component
export class SpatialMemoryStore extends BaseScriptComponent {
  private readonly capacity = 6
  private memories: SpatialMemory[] = []
  private nextId = 1

  public addOrUpdate(label: string, position: vec3, normal: vec3 = vec3.up()): SpatialMemory {
    const displayLabel = label.trim()
    const key = this.normalize(displayLabel)
    const existing = this.memories.find((memory) => this.normalize(memory.label) === key)
    if (existing) {
      existing.label = displayLabel
      existing.position = this.copy(position)
      existing.normal = this.copy(normal)
      existing.savedAtSeconds = getTime()
      print(`[HotNCold][Memory] updated ${displayLabel}; count=${this.memories.length}`)
      return existing
    }

    if (this.memories.length >= this.capacity) {
      const oldest = this.memories.reduce((a, b) => a.savedAtSeconds <= b.savedAtSeconds ? a : b)
      print(`[HotNCold][Memory] capacity=${this.capacity}; replacing oldest ${oldest.label}`)
      this.memories.splice(this.memories.indexOf(oldest), 1)
    }

    const memory: SpatialMemory = {
      id: `memory-${this.nextId++}`,
      label: displayLabel,
      position: this.copy(position),
      normal: this.copy(normal),
      savedAtSeconds: getTime(),
      anchorIdentifier: null,
      anchorReference: null,
    }
    this.memories.push(memory)
    print(`[HotNCold][Memory] added ${displayLabel}; count=${this.memories.length}`)
    return memory
  }

  public getAll(): SpatialMemory[] { return this.memories.slice() }
  public getById(id: string): SpatialMemory | null { return this.memories.find((memory) => memory.id === id) || null }

  public remove(id: string): boolean {
    const index = this.memories.findIndex((memory) => memory.id === id)
    if (index < 0) return false
    this.memories.splice(index, 1)
    return true
  }

  public clear(): void { this.memories = [] }
  public getCount(): number { return this.memories.length }

  public attachAnchor(id: string, anchorIdentifier: string, anchorReference: unknown): void {
    const memory = this.getById(id)
    if (!memory) return
    memory.anchorIdentifier = anchorIdentifier
    memory.anchorReference = anchorReference
  }

  private normalize(label: string): string { return label.trim().toLowerCase() }
  private copy(value: vec3): vec3 { return new vec3(value.x, value.y, value.z) }
}
