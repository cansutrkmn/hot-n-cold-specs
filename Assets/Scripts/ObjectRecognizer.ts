import {Gemini} from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import {CaptureIntent} from "./CaptureIntent"

export interface RecognitionResult {
  success: boolean
  label?: string
  confidence?: number
  centerX?: number
  centerY?: number
  box?: [number, number, number, number]
  detections?: ObjectDetection[]
  source: "preview-gemini" | "device-gemini" | "gemini-failure"
  error?: string
}

export interface ObjectDetection {
  label: string
  confidence: number
  box: [number, number, number, number]
}

@component
export class ObjectRecognizer extends BaseScriptComponent {
  @input geminiModel = "gemini-2.5-flash"
  @input minimumConfidence = 0.45
  @input centralTolerance1000 = 220

  public async recognize(intent: CaptureIntent): Promise<RecognitionResult> {
    try {
      if (!intent.frame) throw new Error("camera frame unavailable")
      const result = global.deviceInfoSystem.isEditor()
        ? await this.recognizePreviewFrame(intent.frame)
        : await this.recognizeDeviceFrame(intent.frame)
      const rawSanitized = result.detections.map((d) => `${d.label}:${d.confidence.toFixed(2)}:[${d.box.map((v) => v.toFixed(0)).join(",")}]`).join(" | ")
      print(`[HotNCold][Recognizer] detections ${rawSanitized || "NONE"}`)
      if (!result.selected || !this.isValidLabel(result.selected.label) || result.selected.confidence < this.minimumConfidence) {
        throw new Error("no clear centered object")
      }
      const selected = result.selected
      const centerX = ((selected.box[1] + selected.box[3]) * 0.5) / 1000
      const centerY = ((selected.box[0] + selected.box[2]) * 0.5) / 1000
      const source = global.deviceInfoSystem.isEditor() ? "preview-gemini" : "device-gemini"
      print(`[HotNCold][Recognizer] ${source} selected ${selected.label} confidence=${selected.confidence.toFixed(2)} box=[${selected.box.join(",")}] derivedPoint=(${centerX.toFixed(4)}, ${centerY.toFixed(4)})`)
      return {success: true, label: selected.label, confidence: selected.confidence, centerX, centerY, box: selected.box, detections: result.detections, source}
    } catch (error) {
      print(`[HotNCold][Recognizer] recognition failed: ${error}`)
      return {success: false, source: "gemini-failure", error: String(error)}
    }
  }

  private recognizePreviewFrame(texture: Texture): Promise<{detections: ObjectDetection[]; selected?: ObjectDetection}> {
    return this.recognizeTexture(texture)
  }

  private recognizeDeviceFrame(texture: Texture): Promise<{detections: ObjectDetection[]; selected?: ObjectDetection}> {
    return this.recognizeTexture(texture)
  }

  private async recognizeTexture(texture: Texture): Promise<{detections: ObjectDetection[]; selected?: ObjectDetection}> {
    const imageBase64 = await new Promise<string>((resolve, reject) => {
      Base64.encodeTextureAsync(texture, resolve, () => reject(new Error("camera JPEG encoding failed")), CompressionQuality.HighQuality, EncodingType.Jpg)
    })

    const response = await this.withTimeout(Gemini.models({
      model: this.geminiModel,
      type: "generateContent",
      body: {contents: [{role: "user", parts: [
        {text: "Detect the prominent recognizable portable or everyday objects visibly present in this image. Return strict JSON only as {\"boxes\":[{\"label\":\"short common noun\",\"confidence\":0.0,\"box_2d\":[ymin,xmin,ymax,xmax]}]}. box_2d coordinates are integers normalized from 0 to 1000, in exactly [ymin,xmin,ymax,xmax] order, and each box must tightly enclose the visible body of the labeled object. Use concise human-readable common nouns, no fixed vocabulary, no room description, and no arbitrary center point. If no recognizable object is visible return {\"boxes\":[]}."},
        {inlineData: {mimeType: "image/jpeg", data: imageBase64}},
      ]}], generationConfig: {responseMimeType: "application/json", temperature: 0.1}},
    } as any), 12000)

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error("Gemini returned no result")
    let parsed: any
    try { parsed = JSON.parse(String(text).trim()) } catch (_) { throw new Error("Gemini returned invalid JSON") }
    const rawBoxes = Array.isArray(parsed.boxes) ? parsed.boxes : []
    const detections: ObjectDetection[] = []
    for (const raw of rawBoxes) {
      const label = typeof raw?.label === "string" ? raw.label.trim() : ""
      const confidence = typeof raw?.confidence === "number" ? raw.confidence : 0
      const box = raw?.box_2d
      if (!this.isValidLabel(label) || !isFinite(confidence) || confidence < 0 || confidence > 1 || !this.isValidBox(box)) continue
      detections.push({label, confidence, box: [box[0], box[1], box[2], box[3]]})
    }
    return {detections, selected: this.selectCenteredDetection(detections)}
  }

  private isValidLabel(label: string): boolean {
    const clean = label.trim()
    return clean.length > 0 && clean.length <= 48 && !clean.includes("\n")
  }

  private isValidBox(value: any): boolean {
    if (!Array.isArray(value) || value.length !== 4 || !value.every((v: any) => typeof v === "number" && isFinite(v) && v >= 0 && v <= 1000)) return false
    return value[0] < value[2] && value[1] < value[3]
  }

  private selectCenteredDetection(detections: ObjectDetection[]): ObjectDetection | undefined {
    const center = 500
    const scored = detections.map((d) => {
      const cy = (d.box[0] + d.box[2]) * 0.5
      const cx = (d.box[1] + d.box[3]) * 0.5
      const distance = Math.sqrt((cx - center) * (cx - center) + (cy - center) * (cy - center))
      const containsCenter = d.box[1] <= center && d.box[3] >= center && d.box[0] <= center && d.box[2] >= center
      return {detection: d, distance, containsCenter}
    })
    const containing = scored.filter((s) => s.containsCenter).sort((a, b) => a.distance - b.distance)
    if (containing.length > 0) return containing[0].detection
    const nearest = scored.sort((a, b) => a.distance - b.distance)[0]
    return nearest && nearest.distance <= this.centralTolerance1000 ? nearest.detection : undefined
  }

  private withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([operation, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Gemini timed out")), timeoutMs))])
  }
}
