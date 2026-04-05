# Design System: Tactical Telemetry & Clinical Precision

## 1. Overview & Creative North Star
**Creative North Star: "The Kinetic Monolith"**

This design system rejects the "softness" of modern consumer web design in favor of high-stakes, tactical utility. Inspired by clinical HUDs and brutalist command centers, it treats the screen not as a page, but as a high-precision instrument. We achieve a premium, custom feel through **Intentional Asymmetry** and **Information Density**. 

The UI should feel like a live data stream—urgent, technical, and absolute. We move beyond the "template" look by utilizing wide tracking, bracketed nomenclature, and a rigid refusal of decorative curves or shadows. This is not a "user-friendly" interface in the traditional sense; it is a specialized tool for operators who demand clarity under pressure.

---

## 2. Colors & Surface Logic
The palette is rooted in a "Void-State" Deep Black, with high-vis accents that signify status and urgency.

*   **Primary (Hazard):** `#ffb59c` / `#ff5f1f` (Neon Orange). Used for critical alerts, primary actions, and hazard states.
*   **Secondary (Status):** `#c7fff0` / `#00f2d1` (Electric Cyan). Reserved for "Go" states, active telemetry, and stable systems.
*   **Tertiary (Structure):** `#5b4138` (Muted Copper). Used for the "Ghost" boundaries and structural scaffolding.

### The Rules of Engagement
*   **The "No-Line" Rule:** While the prompt allows for 1px borders, we use them only for *internal* component logic. Sectioning of the layout must be achieved via background shifts. Use `surface_container_lowest` (#0e0e13) against the `background` (#131318) to define global regions.
*   **Surface Hierarchy:** Depth is created through "Nesting." An active terminal window might use `surface_container_high`, while its internal data readouts sit on `surface_container_highest`.
*   **Signature Textures:** Incorporate a 1px scanline overlay (linear-gradient) across `surface` layers to mimic CRT telemetry. Use a 45-degree hatch pattern (Primary to Primary-Container) for high-priority interaction zones to create a "Hazard Tape" aesthetic.

---

## 3. Typography: Technical Authority
Typography is our primary tool for expressing the "Clinical" vibe. 

*   **Display & Headlines:** **Space Grotesk (Bold).** 
    *   *Rule:* Always Uppercase. 
    *   *Tracking:* +10% to +15% (Wide).
    *   *Purpose:* To scream authority. Use `display-lg` for terminal IDs and `headline-sm` for section headers.
*   **Data & Labels:** **JetBrains Mono.**
    *   *Rule:* Monospaced for perfect vertical alignment of numbers and status codes.
    *   *Syntax:* All system labels must be bracketed: `[SYSTEM_READY]`, `[LATENCY: 24MS]`.
*   **Body:** **Inter.**
    *   *Purpose:* Only used for long-form clinical notes where legibility is paramount. Keep it tight and utilitarian.

---

## 4. Elevation & Depth: Tonal Stacking
There are no shadows in this system. Light does not fall; it emits.

*   **The Layering Principle:** Hierarchy is achieved through the "Pulse." Use `surface_bright` to highlight a hovered container. To create "lift," simply switch the background from `surface_dim` to `surface_container_lowest`.
*   **The "Ghost Border" Fallback:** For secondary containment, use the `outline_variant` (#5b4138) at 20% opacity. It should feel like a faint phosphor trace on a screen, not a physical box.
*   **Glow over Shadow:** Instead of drop shadows, use a 1px inner border of `secondary` or `primary` at 30% opacity to simulate the "bleeding" light of a high-intensity monitor.

---

## 5. Components: Specialized Instruments

### Buttons
*   **Primary:** 0px radius. Background: `primary_container` with a diagonal hatch pattern overlay. Text: `on_primary` (Bold, Uppercase).
*   **Secondary:** 1px border of `secondary`. No fill. On hover, fill with `secondary` at 10% opacity.
*   **Interaction:** 0ms transitions. The system should feel instantaneous and "mechanical."

### Segmented Progress Bars
*   Never use a smooth fill. Divide the bar into 10–20 discrete blocks.
*   **Empty state:** `surface_container_highest`.
*   **Active state:** `secondary_fixed`.

### Input Fields
*   **Styling:** Underline-only or 1px bracketed corners.
*   **Focus State:** The border transitions to `primary` (Neon Orange) with a faint "flicker" animation on entry.
*   **Labeling:** `[INPUT_SEQUENCE]` in `label-sm` (JetBrains Mono) floating above the field.

### Cards & Lists
*   **The "No-Divider" Rule:** Never use a horizontal line to separate list items. Use a 4px vertical gap or a subtle shift to `surface_container_low` on every second item (zebra striping) to maintain the telemetry aesthetic.

### Data Brackets
*   Wrap important numerical values in Muted Copper (`#5b4138`) brackets. 
*   *Example:* `LATENCY: < 00.12ms >`

---

## 6. Do’s and Don’ts

### Do:
*   **Do** align all elements to a strict 8px grid to maintain "Mechanical Symmetry."
*   **Do** use "Technical Noise." Small, non-functional data strings (e.g., `REF_099-X`) in the corners of containers add to the immersion.
*   **Do** use Electric Cyan (`secondary`) for all "nominal" data.

### Don't:
*   **Don't** use border-radius above 2px. Sharp corners are non-negotiable.
*   **Don't** use gradients unless they are 45-degree technical hatches or scanline simulations.
*   **Don't** use "Natural" language. Use "Clinical" language. Instead of "Save Changes," use `[COMMIT_SEQUENCE]`.
*   **Don't** use drop shadows. If a component needs to stand out, give it a 1px colored outline.