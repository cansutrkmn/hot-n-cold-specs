# Hot N Cold

**A spatial memory for the things you forget.**

Hot N Cold is a Spectacles spatial computing prototype that helps people remember everyday objects and where they left them.

Instead of asking the user to manually categorize their physical environment, Hot N Cold uses AI vision to identify the object they are looking at and associates that object with a spatial position.

Later, the user can open their Memories, select an object, and follow an environmental thermal crystal trail back to its remembered location.

> You don’t organize the objects. You organize your memory of where they are.

## Experience

1. Look at an everyday object.
2. Choose **Remember This**.
3. Gemini vision identifies the object.
4. Hot N Cold resolves the corresponding spatial position.
5. Confirm the detected object.
6. The object is added to **Memories**.
7. Select a remembered object later.
8. Follow the crystal trail as it changes from cold blue to warm amber/red.
9. At the remembered position, Hot N Cold presents a localized **There it is** confirmation.

## Spatial Memories

Hot N Cold supports multiple session-scoped memories.

Each memory stores:

- a human-readable AI-generated label
- a world-space position
- a surface normal
- a session timestamp

The current implementation supports up to six memories. Re-recognizing the same normalized label updates its remembered position instead of creating a duplicate.

The Memories drawer can also be invoked through a left-palm interaction. In Preview, the drawer is positioned relative to the detected left palm while remaining camera-facing.

## AI Recognition

The recognition path uses:

**Spectacles Camera → Remote Service Gateway → Gemini 2.5 Flash**

Gemini returns open-ended object detections rather than using a fixed whitelist.

The selected detection includes a bounding box. Hot N Cold derives an image-space point from that box and uses the camera projection/spatial-query pipeline to associate the recognized object with a position in the environment.

## Thermal Crystal Guidance

Navigation intentionally avoids a conventional arrow, compass, or minimap.

Instead, Hot N Cold creates a spatial thermal trail that grows through the environment:

**cold blue → cyan → amber → hot coral/red**

As the wearer approaches the remembered position, the trail becomes warmer and more active before converging at the destination.

## CLAD / Preview Validation

The project was developed iteratively with CLAD and tested extensively in Lens Studio Interactive Preview.

Validated Preview behavior includes:

- real Gemini object recognition through Remote Service Gateway
- AI bounding-box-derived spatial targeting
- spatial object confirmation
- session-scoped memory storage
- multiple simultaneous memories
- memory selection and target switching
- environmental thermal crystal guidance
- COLD → WARM → HOT progression
- localized FOUND treatment
- left-palm Memories invocation with LEAF
- palm-relative Memories drawer placement

A production-path Preview test successfully stored multiple real recognized objects, and the multi-memory drawer/search architecture was also exercised independently. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}

## Current Scope

This hackathon build intentionally focuses on the core spatial-memory interaction.

Memories are currently session-scoped. Cross-session persistence is not claimed.

Physical Spectacles validation is still required for final device ergonomics, real-world tracking stability, display appearance, and hand-interaction comfort.

Interactive Preview is useful for development and validation, but it is not a substitute for final hardware testing.

## Built With

- Lens Studio
- Spectacles Interaction Kit
- Spectacles UIKit
- Remote Service Gateway
- Gemini 2.5 Flash
- LEAF
- TypeScript
- CLAD
