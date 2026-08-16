import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {SpatialMemoryStore, SpatialMemory} from "./SpatialMemoryStore"

interface DrawerRow {
  object: SceneObject
  content: ElementContent
  accent: Text
  memoryId: string
  basePosition: vec3
  phase: number
}

@component
export class MemoryDrawer extends BaseScriptComponent {
  @input store!: SpatialMemoryStore

  public readonly onSelected = new Event<string>()
  public readonly onClosed = new Event<void>()

  private root!: SceneObject
  private rows: DrawerRow[] = []
  private title!: Text
  private emptyTitle!: Text
  private emptyHint!: Text
  private openAmount = 0
  private wantedOpen = false
  private selectedId = ""
  private elapsed = 0

  onAwake(): void {
    this.build()
    this.root.enabled = false
    this.createEvent("UpdateEvent").bind(() => this.updatePresentation())
  }

  public open(): void {
    this.refresh()
    this.wantedOpen = true
    this.openAmount = 0
    this.selectedId = ""
    this.root.enabled = true
    print(`[HotNCold][Drawer] opened count=${this.store.getCount()}`)
  }

  public close(notify: boolean = true): void {
    this.wantedOpen = false
    if (notify) this.onClosed.invoke()
  }

  public isOpen(): boolean { return this.wantedOpen }

  private build(): void {
    this.root = global.scene.createSceneObject("Memory Drawer Visuals")
    this.root.setParent(this.sceneObject)
    this.root.createComponent("Component.Canvas")

    this.title = this.addText("MEMORIES", new vec3(0, 6.4, 0), 28, new vec3(0.72, 0.95, 1))
    this.emptyTitle = this.addText("No memories yet", new vec3(0, 1.6, 0), 22, new vec3(1, 0.96, 0.86))
    this.emptyHint = this.addText("Remember something first.", new vec3(0, -0.7, 0), 16, new vec3(0.58, 0.82, 0.92))

    for (let i = 0; i < 6; i++) this.rows.push(this.createRow(i))

    const closeObject = global.scene.createSceneObject("Close Memories")
    closeObject.setParent(this.root)
    closeObject.getTransform().setLocalPosition(new vec3(0, -9.2, 0.3))
    const closeButton = closeObject.createComponent(Button.getTypeName()) as Button
    closeButton.size = new vec3(5.2, 2.2, 0.5)
    const closeContent = closeObject.createComponent(ElementContent.getTypeName()) as ElementContent
    closeContent.text = "Close"
    closeContent.textSize = 17
    closeContent.autoResize = false
    closeContent.sizeOverride = new vec2(4.8, 1.8)
    closeContent.contentAlignment = "center"
    closeButton.onTriggerUp.add(() => this.close(true))
  }

  private createRow(index: number): DrawerRow {
    const object = global.scene.createSceneObject(`Memory Drawer Row ${index + 1}`)
    object.setParent(this.root)
    const basePosition = new vec3(index * 0.22, 4.0 - index * 2.35, index * 0.28)
    object.getTransform().setLocalPosition(basePosition)
    const button = object.createComponent(Button.getTypeName()) as Button
    button.size = new vec3(12.2, 2.15, 0.55)
    const content = object.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = ""
    content.textSize = 19
    content.autoResize = false
    content.sizeOverride = new vec2(11.1, 1.8)
    content.contentAlignment = "center"

    const accentObject = global.scene.createSceneObject(`Memory Seed ${index + 1}`)
    accentObject.setParent(object)
    accentObject.getTransform().setLocalPosition(new vec3(-5, 0, 0.3))
    const accent = accentObject.createComponent("Component.Text") as Text
    accent.text = "✦"
    accent.size = 18
    accent.depthTest = true
    accent.textFill.color = new vec4(0.18, 0.78, 1, 0.78)
    accent.horizontalAlignment = HorizontalAlignment.Center
    accent.verticalAlignment = VerticalAlignment.Center
    accent.layoutRect = Rect.create(-1, 1, -1, 1)

    const row: DrawerRow = {object, content, accent, memoryId: "", basePosition, phase: index * 0.9}
    button.onTriggerUp.add(() => this.select(row))
    return row
  }

  private refresh(): void {
    const memories = this.store.getAll()
    this.emptyTitle.getSceneObject().enabled = memories.length === 0
    this.emptyHint.getSceneObject().enabled = memories.length === 0
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i]
      const memory = memories[i]
      row.object.enabled = !!memory
      row.memoryId = memory?.id || ""
      row.content.text = memory ? this.titleCase(memory.label) : ""
      row.object.getTransform().setLocalPosition(row.basePosition)
      row.object.getTransform().setLocalScale(vec3.one())
    }
  }

  private select(row: DrawerRow): void {
    if (!row.memoryId || this.selectedId) return
    const memory: SpatialMemory | null = this.store.getById(row.memoryId)
    if (!memory) return
    this.selectedId = row.memoryId
    print(`[HotNCold][Drawer] selected ${memory.label}`)
    setTimeout(() => {
      const id = this.selectedId
      this.wantedOpen = false
      this.onSelected.invoke(id)
    }, 220)
  }

  private updatePresentation(): void {
    if (!this.root.enabled) return
    const dt = getDeltaTime()
    this.elapsed += dt
    this.openAmount += ((this.wantedOpen ? 1 : 0) - this.openAmount) * Math.min(1, dt * (this.wantedOpen ? 8 : 11))
    const rootScale = 0.9 + this.openAmount * 0.1
    this.root.getTransform().setLocalScale(new vec3(rootScale, rootScale, rootScale))
    for (const row of this.rows) {
      if (!row.object.enabled) continue
      const selected = row.memoryId === this.selectedId
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * (selected ? 10 : 1.7) + row.phase)
      const offset = selected ? 2.2 : pulse * 0.12
      row.object.getTransform().setLocalPosition(row.basePosition.add(new vec3(0, 0, -offset)))
      const scale = selected ? 1.045 : 1
      row.object.getTransform().setLocalScale(new vec3(scale, scale, scale))
      row.accent.textFill.color = selected
        ? new vec4(1, 0.58 + pulse * 0.28, 0.18, 1)
        : new vec4(0.16, 0.72 + pulse * 0.16, 1, 0.7 + pulse * 0.2)
    }
    if (!this.wantedOpen && this.openAmount < 0.02) this.root.enabled = false
  }

  private addText(value: string, position: vec3, size: number, color: vec3): Text {
    const object = global.scene.createSceneObject(value)
    object.setParent(this.root)
    object.getTransform().setLocalPosition(position)
    const text = object.createComponent("Component.Text") as Text
    text.text = value
    text.size = size
    text.depthTest = true
    text.textFill.color = new vec4(color.x, color.y, color.z, 1)
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Overflow
    text.verticalOverflow = VerticalOverflow.Overflow
    text.layoutRect = Rect.create(-8, 8, -1.5, 1.5)
    return text
  }

  private titleCase(value: string): string {
    return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value
  }
}
