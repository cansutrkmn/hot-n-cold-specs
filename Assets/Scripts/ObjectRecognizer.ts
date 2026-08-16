import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"

export interface RecognitionResult {
  success: boolean
  label?: string
  source: "preview-mock" | "gemini" | "gemini-failure"
  error?: string
}

@component
export class ObjectRecognizer extends BaseScriptComponent {
  @input previewMockLabel = "Keys"
  @input geminiModel = "gemini-2.0-flash"

  public async recognize(): Promise<RecognitionResult> {
    if (global.deviceInfoSystem.isEditor()) {
      print(`[HotNCold][Recognizer] Preview mock recognized ${this.previewMockLabel}`)
      return {success: true, label: this.previewMockLabel, source: "preview-mock"}
    }

    try {
      const label = await this.recognizeFromSpecsCamera()
      print(`[HotNCold][Recognizer] Gemini recognized ${label}`)
      if (!this.isValidLabel(label)) throw new Error("Gemini returned an invalid label")
      return {success: true, label, source: "gemini"}
    } catch (error) {
      print(`[HotNCold][Recognizer] recognition failed: ${error}`)
      return {success: false, source: "gemini-failure", error: String(error)}
    }
  }

  // Real device boundary: CameraModule frame -> JPEG base64 -> Gemini through installed RSG.
  // The controller depends only on recognize(), so this remote path can fail without blocking the experience.
  private async recognizeFromSpecsCamera(): Promise<string> {
    const cameraModule = require("LensStudio:CameraModule") as CameraModule
    const request = CameraModule.createCameraRequest()
    request.cameraId = CameraModule.CameraId.Default_Color
    request.imageSmallerDimension = 512
    const texture = cameraModule.requestCamera(request)
    const provider = texture.control as CameraTextureProvider

    await new Promise<void>((resolve) => {
      const registration = provider.onNewFrame.add(() => {
        provider.onNewFrame.remove(registration)
        resolve()
      })
    })

    const imageBase64 = await new Promise<string>((resolve, reject) => {
      Base64.encodeTextureAsync(texture, resolve, () => reject(new Error("camera JPEG encoding failed")), CompressionQuality.HighQuality, EncodingType.Jpg)
    })

    const response = await this.withTimeout(Gemini.models({
      model: this.geminiModel,
      type: "generateContent",
      body: {contents: [{role: "user", parts: [
        {text: "Identify the single everyday object centered in view. Reply with only its short common noun, title-cased."},
        {inlineData: {mimeType: "image/jpeg", data: imageBase64}},
      ]}]},
    } as any), 12000)

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error("Gemini returned no label")
    return String(text).trim().replace(/[.!?]+$/, "")
  }

  private isValidLabel(label: string): boolean {
    const clean = label.trim()
    return clean.length > 0 && clean.length <= 48 && !clean.includes("\n")
  }

  private withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([operation, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Gemini timed out")), timeoutMs))])
  }
}
