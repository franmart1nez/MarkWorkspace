# Direct crop colorization prompt

Inspect all images before filling brackets. These are prompt words, not model
selectors. Apply only supported live controls under `GENERATION_POLICY.md`.

```text
Colorize the ORIGINAL source crop from target view [ID], rectangle
[x, y, width, height] on its [width x height] original canvas.
Image 1 is this crop and is the sole geometry authority: preserve identity,
anatomy, silhouette, pose, fine sculpted detail, exact part positions, camera,
framing, background and boundary landmarks [observed features].

Image 2 is the SUPPLIED FINISHED Composite 01 of this same sculpture. It is the
highest appearance reference for colors, materials, surface finish, contrast,
lighting and shadows. Transfer this appearance to the target's existing forms;
preserve the target's own perspective, source light direction and geometry.
[Images 3...] are shared client-approved quality examples, used only for
[observed realism, texture fidelity and material separation]. When appearance
differs, the finished Composite 01 takes priority.

Return one full-bleed colorized crop at the source aspect ratio and maximum
available fidelity. Preserve [overlap/context landmarks] for a masked join at
the recorded source coordinates. Do not move or invent forms, copy another
view's camera, add objects/text or return a comparison/reference collage.
Match adjacent approved crop appearance [if available]. No later manual color
or lighting correction is planned in Photoshop.
```

Compare the output against its exact original crop and finished master. Preserve
rejected versions and reasons. Generate/review the complete batch before montage.
