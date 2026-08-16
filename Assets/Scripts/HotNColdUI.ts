import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"

@component
export class HotNColdUI extends BaseScriptComponent {
  public readonly onPrimary = new Event<void>()
  private statusText!: Text
  private detailText!: Text
  private actionContent!: ElementContent
  private actionObject!: SceneObject

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = 34; flex.height = -1; flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Stretch; flex.justifyContent = FlexJustify.Center
    flex.rowGap = 1.2; flex.paddingTop = 2; flex.paddingBottom = 2; flex.paddingLeft = 2; flex.paddingRight = 2
    flex.onLayoutComplete.add(r => { plate.size = new vec2(r.containerWidth, r.containerHeight) })

    this.statusText = this.addText(content, "Status", "HOT N COLD", 4.5, 86)
    this.detailText = this.addText(content, "Detail", "", 3.2, 40)

    const action = global.scene.createSceneObject("PrimaryAction")
    this.actionObject = action
    action.setParent(content)
    const button = action.createComponent(Button.getTypeName()) as Button
    button.size = new vec3(22, 5.5, 1)
    this.actionContent = action.createComponent(ElementContent.getTypeName()) as ElementContent
    this.actionContent.text = "Remember This"
    this.actionContent.textSize = 39
    this.actionContent.autoResize = false
    this.actionContent.sizeOverride = new vec2(20, 4.5)
    this.actionContent.contentAlignment = "center"
    action.createComponent(FlexItem.getTypeName())

    this.createEvent("OnStartEvent").bind(() => {
      button.onTriggerUp.add(() => this.onPrimary.invoke())
    })
  }

  public render(status: string, detail: string, action: string, actionVisible: boolean = true): void {
    this.statusText.text = status
    this.detailText.text = detail
    this.actionContent.text = action
    this.actionObject.enabled = actionVisible
    print(`[HotNCold][UI] ${status} | ${detail} | ${action}`)
  }

  private addText(parent: SceneObject, name: string, value: string, height: number, size: number): Text {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    const text = object.createComponent("Component.Text") as Text
    text.text = value; text.size = size; text.depthTest = true
    text.horizontalAlignment = HorizontalAlignment.Center; text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Overflow; text.verticalOverflow = VerticalOverflow.Overflow
    text.layoutRect = Rect.create(-15, 15, -height / 2, height / 2)
    object.createComponent(FlexItem.getTypeName())
    return text
  }
}
