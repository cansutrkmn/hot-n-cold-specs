import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {LeftPalmDrawerTrigger} from "../Scripts/LeftPalmDrawerTrigger"
import {HotNColdController} from "../Scripts/HotNColdController"
import {PalmRelativeDrawerAnchor} from "../Scripts/PalmRelativeDrawerAnchor"

@component
export class HotNColdLeftPalmTest extends Scenario {
  async run(): Promise<void> {
    const leftInteractor = LeafHandInteractor.get("left")
    const leftHand = SIK.HandInputData.getHand("left")
    const triggerObject = findSceneObjectByName("Left Palm Drawer Trigger")
    const trigger = triggerObject.getComponent(LeftPalmDrawerTrigger.getTypeName()) as LeftPalmDrawerTrigger
    const anchorObject = findSceneObjectByName("Palm Relative Drawer Anchor")
    const anchor = anchorObject.getComponent(PalmRelativeDrawerAnchor.getTypeName()) as PalmRelativeDrawerAnchor
    const controllerObject = findSceneObjectByName("HotNColdController")
    const controller = controllerObject.getComponent(HotNColdController.getTypeName()) as HotNColdController
    let dwellSeconds = 0
    let presented = false
    let marker: SceneObject | null = null

    const sampleFor = async (durationMs: number): Promise<void> => {
      const stepMs = 50
      for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs) {
        const tracked = leftHand.isTracked()
        const facing = leftHand.isFacingCamera()
        dwellSeconds = tracked && facing ? dwellSeconds + stepMs / 1000 : 0
        if (dwellSeconds >= 0.4) presented = true
        const center = leftHand.getPalmCenter()
        if (marker && center) marker.getTransform().setWorldPosition(center)
        await sleep(stepMs)
      }
    }

    trigger.resetTestCounters()

    await leftInteractor.hand.makeGesture("relaxed", undefined, 0)
    await leftInteractor.hand.hide(0)
    await sampleFor(250)
    expect(leftHand.isTracked()).toBe(false)
    print("[HotNCold][PalmTest] LEFT_PALM_BASELINE tracked=false")

    await leftInteractor.hand.setScreenPosition(new vec2(0.28, 0.62), 70, 250)
    await sampleFor(300)
    const availableAngle = leftHand.getFacingCameraAngle()
    const availablePitch = leftHand.getPalmPitchAngle()
    print(`[HotNCold][PalmTest] LEFT_HAND_TRACKED facing=${leftHand.isFacingCamera()} angle=${this.numberOrNull(availableAngle)} pitch=${this.numberOrNull(availablePitch)}`)
    expect(leftHand.isTracked()).toBe(true)

    dwellSeconds = 0
    presented = false
    await leftInteractor.hand.makeGesture("palm", undefined, 250)
    await sampleFor(1000)
    const palmAngle = leftHand.getFacingCameraAngle()
    const palmPitch = leftHand.getPalmPitchAngle()
    const palmCenter = leftHand.getPalmCenter()
    print(`[HotNCold][PalmTest] LEFT_PALM_PRESENTED facing=${leftHand.isFacingCamera()} angle=${this.numberOrNull(palmAngle)} pitch=${this.numberOrNull(palmPitch)} center=${this.vectorOrNull(palmCenter)} dwell=${dwellSeconds.toFixed(2)}`)
    expect(leftHand.isTracked()).toBe(true)
    expect(leftHand.isFacingCamera()).toBe(true)
    expect(palmCenter !== null).toBe(true)
    expect(presented).toBe(true)
    expect(controller.isMemoryDrawerOpen()).toBe(true)
    expect(trigger.openRequestCount).toBe(1)
    expect(anchor.isPalmPlacementActive()).toBe(true)
    const drawerStart = anchor.getDrawerWorldPosition()
    const palmDistanceStart = anchor.getPalmDistanceCm()
    const facingStart = anchor.getCameraFacingDot()
    print(`[HotNCold][PalmTest] DRAWER_PALM_OPEN drawer=${this.vectorOrNull(drawerStart)} palmDistance=${palmDistanceStart.toFixed(1)} facingDot=${facingStart.toFixed(3)}`)
    expect(palmDistanceStart).toBeGreaterThan(10)
    expect(palmDistanceStart).toBeLessThan(18)
    expect(facingStart).toBeGreaterThan(0.98)

    marker = global.scene.createSceneObject("LEAF Left Palm Marker")
    const markerText = marker.createComponent("Component.Text") as Text
    markerText.text = "✦"
    markerText.size = 18
    markerText.depthTest = true
    markerText.textFill.color = new vec4(0.2, 0.9, 1, 1)
    marker.getTransform().setWorldPosition(palmCenter!)
    const markerStart = marker.getTransform().getWorldPosition()
    await leftInteractor.hand.setScreenPosition(new vec2(0.38, 0.66), 70, 300)
    await sampleFor(450)
    const movedCenter = leftHand.getPalmCenter()
    const markerEnd = marker.getTransform().getWorldPosition()
    const markerError = movedCenter ? markerEnd.distance(movedCenter) : 999
    print(`[HotNCold][PalmTest] PALM_MARKER_FOLLOW start=${this.vectorOrNull(markerStart)} end=${this.vectorOrNull(markerEnd)} error=${markerError.toFixed(2)}`)
    expect(markerEnd.distance(markerStart)).toBeGreaterThan(1)
    expect(markerError).toBeCloseTo(0, 1)
    const drawerEnd = anchor.getDrawerWorldPosition()
    const drawerTravel = drawerEnd.distance(drawerStart)
    const palmDistanceEnd = anchor.getPalmDistanceCm()
    const facingEnd = anchor.getCameraFacingDot()
    print(`[HotNCold][PalmTest] DRAWER_PALM_MOVED start=${this.vectorOrNull(drawerStart)} end=${this.vectorOrNull(drawerEnd)} travel=${drawerTravel.toFixed(1)} palmDistance=${palmDistanceEnd.toFixed(1)} facingDot=${facingEnd.toFixed(3)}`)
    expect(drawerTravel).toBeGreaterThan(1)
    expect(palmDistanceEnd).toBeGreaterThan(10)
    expect(facingEnd).toBeGreaterThan(0.98)
    marker.destroy()
    marker = null

    await leftInteractor.hand.makeGesture("relaxed", undefined, 200)
    await leftInteractor.hand.hide(250)
    dwellSeconds = 0
    presented = false
    await sampleFor(500)
    print(`[HotNCold][PalmTest] LEFT_PALM_RELEASED tracked=${leftHand.isTracked()} presented=${presented}`)
    expect(leftHand.isTracked()).toBe(false)
    expect(presented).toBe(false)
    expect(controller.isMemoryDrawerOpen()).toBe(false)
    expect(anchor.isPalmPlacementActive()).toBe(false)
    expect(trigger.openRequestCount).toBe(1)
    expect(trigger.closeRequestCount).toBe(1)
  }

  private numberOrNull(value: number | null): string {
    return value === null ? "null" : value.toFixed(1)
  }

  private vectorOrNull(value: vec3 | null): string {
    return value === null ? "null" : `(${value.x.toFixed(1)},${value.y.toFixed(1)},${value.z.toFixed(1)})`
  }
}
