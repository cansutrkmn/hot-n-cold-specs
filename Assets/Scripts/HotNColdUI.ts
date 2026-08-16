import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"

@component
export class HotNColdUI extends BaseScriptComponent {
  public readonly onPrimary = new Event<void>()
  public readonly onMemories = new Event<void>()
  private statusText!: Text
  private detailText!: Text
  private actionContent!: ElementContent
  private actionObject!: SceneObject
  private memoriesObject!: SceneObject
  private transientTime = 0
  private statusAlpha = 0
  private detailAlpha = 0
  private actionScale = 0
  private statusWanted = false
  private detailWanted = false
  private actionWanted = false

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.statusText = this.addText("Status", new vec3(0, 12.8, 0), 4.2, 66, new vec3(1, 0.96, 0.86))
    this.detailText = this.addText("Detail", new vec3(0, 8.8, 0), 3.2, 36, new vec3(0.62, 0.93, 1))

    this.actionObject = global.scene.createSceneObject("PrimaryAction")
    this.actionObject.setParent(this.sceneObject)
    this.actionObject.getTransform().setLocalPosition(new vec3(3.6, -12.8, 0))
    const button = this.actionObject.createComponent(Button.getTypeName()) as Button
    button.size = new vec3(12.8, 4.2, 0.7)
    this.actionContent = this.actionObject.createComponent(ElementContent.getTypeName()) as ElementContent
    this.actionContent.text = "Remember This"
    this.actionContent.textSize = 26
    this.actionContent.autoResize = false
    this.actionContent.sizeOverride = new vec2(12.2, 3.5)
    this.actionContent.contentAlignment = "center"

    this.memoriesObject = global.scene.createSceneObject("MemoriesAction")
    this.memoriesObject.setParent(this.sceneObject)
    this.memoriesObject.getTransform().setLocalPosition(new vec3(-8, -12.8, 0.25))
    const memoriesButton = this.memoriesObject.createComponent(Button.getTypeName()) as Button
    memoriesButton.size = new vec3(6.6, 3.5, 0.55)
    const memoriesContent = this.memoriesObject.createComponent(ElementContent.getTypeName()) as ElementContent
    memoriesContent.text = "Memories"
    memoriesContent.textSize = 23
    memoriesContent.autoResize = false
    memoriesContent.sizeOverride = new vec2(6.1, 3)
    memoriesContent.contentAlignment = "center"

    this.createEvent("OnStartEvent").bind(() => {
      button.onTriggerUp.add(() => this.onPrimary.invoke())
      memoriesButton.onTriggerUp.add(() => this.onMemories.invoke())
    })
    this.createEvent("UpdateEvent").bind(() => this.updatePresentation())
  }

  public render(status: string, detail: string, action: string, actionVisible: boolean = true): void {
    this.statusText.text = status
    this.detailText.text = detail
    this.statusWanted = status.length > 0
    this.detailWanted = detail.length > 0
    if (this.statusWanted) {
      this.statusText.getSceneObject().enabled = true
      this.statusAlpha = Math.min(this.statusAlpha, 0.08)
      this.statusText.getSceneObject().getTransform().setLocalScale(new vec3(0.94, 0.94, 0.94))
    }
    if (this.detailWanted) {
      this.detailText.getSceneObject().enabled = true
      this.detailAlpha = Math.min(this.detailAlpha, 0.08)
    }
    this.actionContent.text = action
    this.actionWanted = actionVisible && action.length > 0
    if (this.actionWanted) {
      this.actionObject.enabled = true
      this.actionScale = Math.min(this.actionScale, 0.82)
    }
    this.transientTime = status === "Remembered" ? 1.35 : this.isTransientMessage(status) ? 2.35 : 0
    print(`[HotNCold][UI] ${status} | ${detail} | ${action}`)
  }

  public setMemoriesVisible(visible: boolean): void {
    this.memoriesObject.enabled = visible
  }

  public hideAllControls(): void {
    this.actionWanted = false
    this.memoriesObject.enabled = false
  }

  private updatePresentation(): void {
    const dt = getDeltaTime()
    if (this.transientTime > 0) {
      this.transientTime -= dt
      if (this.transientTime <= 0) {
        this.statusWanted = false
        this.detailWanted = false
      }
    }
    this.statusAlpha += ((this.statusWanted ? 1 : 0) - this.statusAlpha) * Math.min(1, dt * (this.statusWanted ? 7.5 : 5.5))
    this.detailAlpha += ((this.detailWanted ? 0.88 : 0) - this.detailAlpha) * Math.min(1, dt * 6.5)
    this.actionScale += ((this.actionWanted ? 1 : 0) - this.actionScale) * Math.min(1, dt * (this.actionWanted ? 9 : 7))
    this.statusText.textFill.color = new vec4(1, 0.96, 0.86, this.statusAlpha)
    this.detailText.textFill.color = new vec4(0.62, 0.93, 1, this.detailAlpha)
    const statusScale = 0.94 + this.statusAlpha * 0.06
    this.statusText.getSceneObject().getTransform().setLocalScale(new vec3(statusScale, statusScale, statusScale))
    this.actionObject.getTransform().setLocalScale(new vec3(this.actionScale, this.actionScale, this.actionScale))
    if (!this.statusWanted && this.statusAlpha < 0.015) this.statusText.getSceneObject().enabled = false
    if (!this.detailWanted && this.detailAlpha < 0.015) this.detailText.getSceneObject().enabled = false
    if (!this.actionWanted && this.actionScale < 0.02) this.actionObject.enabled = false
  }

  private isTransientMessage(status: string): boolean {
    return status === "Look around — follow the crystal trail."
  }

  private addText(name: string, position: vec3, height: number, size: number, color: vec3): Text {
    const object = global.scene.createSceneObject(name)
    object.setParent(this.sceneObject)
    object.getTransform().setLocalPosition(position)
    const text = object.createComponent("Component.Text") as Text
    text.text = ""
    text.size = size
    text.depthTest = true
    text.textFill.color = new vec4(color.x, color.y, color.z, 0)
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Overflow
    text.verticalOverflow = VerticalOverflow.Overflow
    text.layoutRect = Rect.create(-14, 14, -height / 2, height / 2)
    return text
  }
}
