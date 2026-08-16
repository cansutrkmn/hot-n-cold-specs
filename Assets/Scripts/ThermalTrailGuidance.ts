import {TemperatureBand} from "./TemperatureGuidance"
export type HeatTrend = "START" | "WARMER" | "COLDER" | "STEADY"

interface CrystalVisual {
  object: SceneObject
  material: Material
  desiredPosition: vec3
  surfaceRotation: quat
  surfaceResolved: boolean
  t: number
  lateral: number
  phase: number
  flow: boolean
  sizeBias: number
  twist: number
}

@component
export class ThermalTrailGuidance extends BaseScriptComponent {
  @input trackedObject!: SceneObject
  @input deviceTracking!: DeviceTracking
  @input crystalMaterial!: Material
  @input clusterCount = 24
  @input flowCount = 6
  @input corridorWidthCm = 24
  @input previewSurfaceOffsetCm = 0.8
  @input previewFloorBelowWearerCm = 68
  @input deviceFloorBelowWearerCm = 150
  @input rerouteDistanceCm = 55

  private crystals: CrystalVisual[] = []
  private active = false
  private found = false
  private target = vec3.zero()
  private targetNormal = vec3.up()
  private routeStart = vec3.zero()
  private routeStartRaw = vec3.zero()
  private heat = 0
  private targetHeat = 0
  private elapsed = 0
  private timeSinceRoute = 0
  private foundAge = 0
  private hitSession: HitTestSession | null = null

  onAwake(): void {
    this.buildPool()
    this.setVisible(false)
    if (!global.deviceInfoSystem.isEditor()) {
      const worldQuery = require("LensStudio:WorldQueryModule") as WorldQueryModule
      const options = HitTestSessionOptions.create()
      options.filter = true
      this.hitSession = worldQuery.createHitTestSessionWithOptions(options)
      this.hitSession.start()
    }
    this.createEvent("UpdateEvent").bind(() => this.updateTrail())
    this.createEvent("OnDestroyEvent").bind(() => this.hitSession?.stop())
  }

  public begin(target: vec3, normal: vec3 = vec3.up()): void {
    this.target = new vec3(target.x, target.y, target.z)
    this.targetNormal = normal.normalize()
    this.active = true
    this.found = false
    this.foundAge = 0
    this.elapsed = 0
    this.timeSinceRoute = 99
    this.heat = 0
    this.targetHeat = 0
    for (const crystal of this.crystals) crystal.object.enabled = crystal.flow
    this.rebuildRoute(true)
    print(`[HotNCold][Trail] started wearer=${this.format(this.routeStartRaw)} target=${this.format(this.target)}`)
  }

  public setGuidance(_band: TemperatureBand, normalizedHeat: number, _trend: HeatTrend): void {
    this.targetHeat = Math.max(0, Math.min(1, normalizedHeat))
  }

  public showFound(): void {
    this.found = true
    this.foundAge = 0
    this.targetHeat = 1
  }

  public hide(): void {
    this.active = false
    this.found = false
    this.setVisible(false)
  }

  private buildPool(): void {
    const clusterCount = Math.max(24, Math.floor(this.clusterCount))
    const flowCount = Math.max(9, Math.floor(this.flowCount))
    for (let i = 0; i < clusterCount + flowCount; i++) {
      const object = global.scene.createSceneObject(i < clusterCount ? `Thermal Crystal ${i}` : `Trail Flow ${i-clusterCount}`)
      object.setParent(this.sceneObject)
      const flow = i >= clusterCount
      const index = flow ? i - clusterCount : i
      const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mesh = this.buildClusterMesh(index + (flow ? 101 : 1), flow ? 3 : 3 + Math.floor(this.unitNoise(index * 4.73) * 5))
      const material = this.crystalMaterial.clone()
      visual.mainMaterial = material
      const t = flow ? index / flowCount : (index + 0.5) / clusterCount
      this.crystals.push({
        object,
        material,
        desiredPosition: vec3.zero(),
        surfaceRotation: quat.quatIdentity(),
        surfaceResolved: flow,
        t,
        lateral: this.noise(index * 3.17) * this.corridorWidthCm,
        phase: index * 1.73,
        flow,
        sizeBias: 0.82 + this.unitNoise(index * 5.31) * 0.42,
        twist: this.unitNoise(index * 8.17) * Math.PI * 2,
      })
    }
  }

  private updateTrail(): void {
    if (!this.active) return
    const dt = getDeltaTime()
    this.elapsed += dt
    if (this.found) this.foundAge += dt
    this.timeSinceRoute += dt
    this.heat += (this.targetHeat - this.heat) * Math.min(1, dt * 2.6)
    if (!this.found && this.timeSinceRoute > 1.25 && this.shouldReroute()) this.rebuildRoute(false)

    const wearer = this.trackedObject.getTransform().getWorldPosition()
    const route = this.target.sub(this.routeStartRaw)
    const routeLengthSq = Math.max(1, route.lengthSquared)
    const progress = Math.max(0, Math.min(1, wearer.sub(this.routeStartRaw).dot(route) / routeLengthSq))
    const pulseSpeed = 0.18 + this.heat * 0.42

    for (const crystal of this.crystals) {
      crystal.object.enabled = crystal.flow || crystal.surfaceResolved
      if (!crystal.object.enabled) continue
      let pathT = crystal.t
      if (crystal.flow) pathT = (this.elapsed * pulseSpeed + crystal.t) % 1
      let position = this.pathPosition(pathT, crystal.lateral * (crystal.flow ? 0.18 : 1))
      if (this.found) {
        const arrival = Math.max(0, Math.min(1, this.foundAge * 1.45 - (1 - crystal.t) * 0.32))
        const eased = 1 - Math.pow(1 - arrival, 3)
        const bloomRadius = crystal.flow ? 4.5 : 2.5 + (1 - crystal.t) * 8
        const bloomOffset = new vec3(Math.cos(crystal.phase) * bloomRadius, Math.sin(crystal.phase * 1.7) * bloomRadius * 0.42, Math.sin(crystal.phase) * bloomRadius)
        position = vec3.lerp(position, this.target.add(bloomOffset), eased)
      }
      if (!crystal.flow) {
        position = crystal.desiredPosition
        const current = crystal.object.getTransform().getWorldPosition()
        position = vec3.lerp(current, crystal.desiredPosition, Math.min(1, dt * 3.8))
      }
      crystal.object.getTransform().setWorldPosition(position)

      const behind = !crystal.flow && pathT < progress - 0.07
      const localHeat = Math.max(0, Math.min(1, pathT * 0.84 + this.heat * 0.34))
      const wave = 0.5 + 0.5 * Math.sin(this.elapsed * (1.2 + localHeat * 5.5) + crystal.phase)
      const densityScale = 0.34 + pathT * 0.76 + this.heat * 0.25
      const reveal = Math.max(0, Math.min(1, this.elapsed * 1.9 - pathT * 0.72))
      const targetClearance = pathT > 0.86 ? 0.38 + (1 - pathT) * 2.3 : 1
      const normalScale = (crystal.flow ? 0.13 + this.heat * 0.14 : densityScale * 0.54) * (behind ? 0.08 : 1) * reveal * crystal.sizeBias * targetClearance
      const foundPulse = this.found ? 0.72 + 0.28 * Math.sin(this.foundAge * 8 + crystal.phase) : 1
      // At arrival the wearer is physically close to the target. Keep the bloom
      // localized and luminous without letting nearby shards fill the field of view.
      const arrivalScale = this.found ? 0.28 : 1
      const scale = normalScale * (0.88 + wave * 0.22) * foundPulse * arrivalScale
      crystal.object.getTransform().setLocalScale(new vec3(scale * (0.82 + crystal.sizeBias * 0.18), scale * (crystal.flow ? 0.7 : 1.18), scale * 0.86))
      const spin = crystal.twist + this.elapsed * (crystal.flow ? 3.8 + this.heat * 2.2 : 0.04)
      crystal.object.getTransform().setWorldRotation(crystal.flow ? quat.angleAxis(spin, vec3.up()) : crystal.surfaceRotation.multiply(quat.angleAxis(spin, vec3.up())))

      const color = crystal.flow ? vec3.lerp(this.heatColor(localHeat), new vec3(1.2, 0.62, 0.24), 0.28) : this.heatColor(localHeat)
      const foundCalm = this.found ? 1.22 - Math.max(0, Math.min(0.38, (this.foundAge - 1.8) * 0.28)) : 1
      const brightness = (crystal.flow ? 1.46 + this.heat * 0.3 : 0.76 + wave * 0.56) * (behind ? 0.12 : 1) * foundCalm
      crystal.material.mainPass.baseColor = new vec4(color.x * brightness, color.y * brightness, color.z * brightness, crystal.flow ? 0.86 : 0.74)
    }
  }

  private rebuildRoute(initial: boolean): void {
    const wearer = this.trackedObject.getTransform().getWorldPosition()
    this.routeStartRaw = new vec3(wearer.x, wearer.y, wearer.z)
    const floorDrop = global.deviceInfoSystem.isEditor() ? this.previewFloorBelowWearerCm : this.deviceFloorBelowWearerCm
    this.routeStart = new vec3(wearer.x, wearer.y - floorDrop + this.previewSurfaceOffsetCm, wearer.z)
    this.timeSinceRoute = 0
    for (const crystal of this.crystals) {
      if (!crystal.flow) this.projectCluster(crystal)
    }
    print(`[HotNCold][Trail] ${initial ? "built" : "reoriented"} route from ${this.format(this.routeStartRaw)} to ${this.format(this.target)}`)
  }

  private shouldReroute(): boolean {
    const wearer = this.trackedObject.getTransform().getWorldPosition()
    const route = this.target.sub(this.routeStartRaw)
    const lengthSq = Math.max(1, route.lengthSquared)
    const t = Math.max(0, Math.min(1, wearer.sub(this.routeStartRaw).dot(route) / lengthSq))
    const closest = this.routeStartRaw.add(route.uniformScale(t))
    const lateralDeviation = new vec3(wearer.x, 0, wearer.z).distance(new vec3(closest.x, 0, closest.z))
    return lateralDeviation > this.rerouteDistanceCm
  }

  private pathPosition(t: number, lateral: number): vec3 {
    const start = this.routeStart
    const end = this.target.add(this.targetNormal.uniformScale(this.previewSurfaceOffsetCm))
    const forward = end.sub(start)
    let side = new vec3(-forward.z, 0, forward.x)
    side = side.lengthSquared > 0.001 ? side.normalize() : vec3.right()
    const meander = Math.sin(t * Math.PI * 3 + 0.7) * this.corridorWidthCm * 0.12
    const lift = Math.sin(t * Math.PI) * 1.4
    return vec3.lerp(start, end, t).add(side.uniformScale(lateral + meander)).add(vec3.up().uniformScale(lift))
  }

  private projectCluster(crystal: CrystalVisual): void {
    crystal.surfaceResolved = false
    crystal.object.enabled = false
    const sample = this.pathPosition(crystal.t, crystal.lateral)
    const rayStart = sample.add(vec3.up().uniformScale(75))
    const rayEnd = sample.sub(vec3.up().uniformScale(170))
    const meshHits = this.deviceTracking?.raycastWorldMesh(rayStart, rayEnd) || []
    if (meshHits.length > 0) {
      this.applySurface(crystal, meshHits[0].position, meshHits[0].normal)
      return
    }
    this.hitSession?.hitTest(rayStart, rayEnd, (hit: WorldQueryHitTestResult | null) => {
      if (!this.active || !hit) return
      this.applySurface(crystal, hit.position, hit.normal)
    })
  }

  private applySurface(crystal: CrystalVisual, position: vec3, rawNormal: vec3): void {
    const normal = rawNormal.lengthSquared > 0.001 ? rawNormal.normalize() : vec3.up()
    const route = this.target.sub(this.routeStart)
    let tangent = route.sub(normal.uniformScale(route.dot(normal)))
    if (tangent.lengthSquared < 0.001) tangent = Math.abs(normal.dot(vec3.up())) < 0.95 ? normal.cross(vec3.up()) : vec3.forward()
    crystal.desiredPosition = position.add(normal.uniformScale(this.previewSurfaceOffsetCm * 0.55))
    crystal.surfaceRotation = quat.lookAt(tangent.normalize(), normal)
    crystal.surfaceResolved = true
    crystal.object.getTransform().setWorldPosition(crystal.desiredPosition)
    crystal.object.enabled = true
  }

  private buildClusterMesh(seed: number, shardCount: number): RenderMesh {
    const builder = new MeshBuilder([{name: "position", components: 3}])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    const vertices: number[] = []
    const indices: number[] = []
    const shard = (x: number, z: number, width: number, height: number, leanX: number, leanZ: number): void => {
      const sides = 6
      const start = vertices.length / 3
      const shoulderY = height * 0.72
      for (let i = 0; i < sides; i++) {
        const angle = i / sides * Math.PI * 2
        vertices.push(x + Math.cos(angle) * width, 0, z + Math.sin(angle) * width)
      }
      for (let i = 0; i < sides; i++) {
        const angle = i / sides * Math.PI * 2
        vertices.push(x + leanX * 0.72 + Math.cos(angle) * width * 0.72, shoulderY, z + leanZ * 0.72 + Math.sin(angle) * width * 0.72)
      }
      const tip = vertices.length / 3
      vertices.push(x + leanX, height, z + leanZ)
      for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides
        const lower = start + i
        const lowerNext = start + next
        const upper = start + sides + i
        const upperNext = start + sides + next
        indices.push(lower, upper, lowerNext, lowerNext, upper, upperNext)
        indices.push(upper, tip, upperNext)
      }
    }
    const dominant = Math.floor(this.unitNoise(seed * 1.31) * shardCount)
    for (let i = 0; i < shardCount; i++) {
      const angle = this.unitNoise(seed * 3.17 + i * 5.13) * Math.PI * 2
      const radius = i === dominant ? this.unitNoise(seed + 7.2) * 0.7 : 0.9 + this.unitNoise(seed * 8.1 + i) * 3.5
      const height = (i === dominant ? 9.2 : 3.1) + this.unitNoise(seed * 2.7 + i * 9.4) * (i === dominant ? 4.1 : 5.6)
      const width = 0.48 + this.unitNoise(seed * 6.9 + i * 2.2) * (i === dominant ? 1.15 : 0.82)
      const lean = 0.35 + this.unitNoise(seed * 4.6 + i * 7.7) * 1.15
      shard(Math.cos(angle) * radius, Math.sin(angle) * radius, width, height, Math.cos(angle) * lean, Math.sin(angle) * lean)
    }
    builder.appendVerticesInterleaved(vertices)
    builder.appendIndices(indices)
    builder.updateMesh()
    return builder.getMesh()
  }

  private heatColor(heat: number): vec3 {
    const cold = new vec3(0.02, 0.32, 1.12)
    const ice = new vec3(0.1, 0.86, 1.16)
    const amber = new vec3(1.18, 0.48, 0.08)
    const hot = new vec3(1.28, 0.16, 0.075)
    if (heat < 0.42) return vec3.lerp(cold, ice, heat / 0.42)
    if (heat < 0.72) return vec3.lerp(ice, amber, (heat - 0.42) / 0.3)
    return vec3.lerp(amber, hot, (heat - 0.72) / 0.28)
  }

  private setVisible(visible: boolean): void {
    for (const crystal of this.crystals) crystal.object.enabled = visible
  }

  private noise(seed: number): number {
    return this.unitNoise(seed) - 0.5
  }

  private unitNoise(seed: number): number {
    const value = Math.sin(seed * 12.9898) * 43758.5453
    return value - Math.floor(value)
  }

  private format(value: vec3): string {
    return `(${value.x.toFixed(1)}, ${value.y.toFixed(1)}, ${value.z.toFixed(1)})`
  }
}
