# Hot N Cold

A spatial memory experience for SPECS that recognizes an everyday object, remembers its location during the current session, and later guides the wearer back using a playful hot-and-cold mechanic.

## How It Works

The wearer centers an everyday object in view and selects **Remember This**. The experience then follows this flow:

**Remember This → AI recognizes the object → center-view WorldQuery resolves its spatial location → user confirms the object → Find Item → COLD / COOL / WARM / HOT → FOUND**

The confirmation marker shows the proposed location before it is saved. During the search, the destination remains hidden so the wearer navigates through temperature and trend feedback rather than a direct pointer.

## Why SPECS

Hot N Cold depends on the relationship between a person, an object, and a place in the physical world. SPECS makes that relationship available hands-free: the wearer can look directly at an object to identify and locate it, walk naturally through the environment, and receive spatial feedback without holding a phone or repeatedly checking a screen. The result turns an ordinary memory task into a lightweight spatial interaction.

## CLAD Development

The experience was designed, built, tested, debugged, and refined through CLAD. Lens Studio Preview provided a deterministic test environment for recognition, target placement, interaction flow, visual temperature states, marker lifecycle, and runtime-log verification. Adversarial distance sequences were also used to verify both **Getting warmer** and **Getting colder** behavior. Product intent and experience decisions came from the creator; CLAD supported implementation and verification.

## Architecture

- **HotNColdController** — owns the experience state machine and coordinates recognition, location, storage, guidance, and UI.
- **ObjectRecognizer** — answers what the centered object is, with separate device and Preview implementations.
- **ObjectLocationResolver** — answers where the centered object is, using WorldQuery on device and a deterministic target in Preview.
- **SpatialMemoryStore** — stores the object label and resolved target position, with an anchor-ready data boundary.
- **TemperatureGuidance** — classifies distance into temperature bands and produces normalized heat.
- **HotNColdVisualGuidance** — renders lightweight peripheral color, pulse, and activity feedback from normalized heat.
- **HotNColdUI** — presents the minimal confirmation, search, recovery, and completion interface.

## AI Object Recognition

On SPECS, the recognition path is:

**Spectacles Camera → JPEG encoding → Gemini through Remote Service Gateway**

Lens Studio Preview uses a deterministic **Keys** mock so the complete interaction can be tested without relying on a network request or physical glasses. Device recognition failures do not silently invent a label; the experience reports the failure and offers a working **Try Again** recovery.

## Spatial Location

On device, `ObjectLocationResolver` casts a center-view ray through Lens Studio's WorldQuery API and uses the resulting real-world surface hit as the proposed object location. Preview uses a deterministic visible debug target for repeatable testing.

The saved position is the resolved **target position**, not the Camera Object or wearer position. The target marker is visible during confirmation, hidden throughout the search, and briefly revealed again at **FOUND**.

## Hot N Cold Guidance

Distance is converted into a normalized heat value that drives a continuous visual transition from icy blue and calm movement to orange/red and more energetic pulses. The named bands remain available for clarity:

**COLD → COOL → WARM → HOT → FOUND**

The controller also compares the current distance with the previous distance to report **Getting warmer** or **Getting colder**. Peripheral unlit mesh cues communicate proximity without tinting the camera feed, blocking vision, or pointing directly toward the target.

## Preview Testing

The release build was verified in Lens Studio Preview with:

- the complete happy path from **Remember This** through **FOUND**;
- an adversarial distance path containing both warmer and colder movement;
- confirmation, search, and FOUND target-marker lifecycle checks;
- state-by-state action and dead-affordance checks;
- final TypeScript compilation and runtime-log inspection with zero final runtime errors.

## Device Validation Limitations

Without physical SPECS hardware, the following could not be directly validated:

- real Camera → Gemini recognition;
- real-environment WorldQuery hit testing;
- physical tracking accuracy;
- final additive-display brightness and color appearance under real-world lighting.

## Requirements

- Lens Studio 5.23; the project was finalized and verified with Lens Studio 5.23.1.26080420.
- A SPECS-targeted project with a Perspective Camera and Device Tracking set to World.
- Spectacles Interaction Kit runtime 0.18.0 (installed Asset Library package metadata: 2.0.0).
- Spectacles UIKit 2.0.0.
- RemoteServiceGateway 2.0.0 for the Gemini device path.
- CameraModule and WorldQueryModule support on SPECS.
- Internet access and the applicable camera-plus-internet permission flow for live recognition.
- A valid Google/Gemini credential configured locally in Lens Studio for device recognition.

## Privacy / Credentials

API credentials are not included in this repository. The checked-in project contains placeholder credential fields only. Add any required Gemini credential locally in Lens Studio and never commit it, paste it into source files, or include it in screenshots or logs intended for publication.

## Future Work

- Persistent spatial anchors.
- Multiple remembered objects.
- Voice interaction.

These items are possible extensions and are not implemented in the current release.
