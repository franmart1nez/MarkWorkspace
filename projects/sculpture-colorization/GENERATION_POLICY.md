# Project-wide generation policy

Revision: **2026-11-08**. Applies to every new sculpture and its subsequent views.

## Highest-quality ChatGPT generation

Use **ChatGPT's native image generator at the highest available quality**. The preferred order is:

1. **GPT Image 2.6 Sunburst (max)** — model identifier `gpt-image-2.6-sunburst`, quality `max` when supported by the live interface.
2. **GPT Image 2.5 Sunburst (max)** — model identifier `gpt-image-2.5-sunburst`, quality `max`, if the preferred model is unavailable through the account/tool.

This image-model fallback is preauthorized. Use actual live tool/UI controls to apply model and quality settings. The current native tool exposes neither selector; when controls are absent, use its available native ChatGPT capability, request maximum detail/fidelity and record actual model/quality as **not exposed**. Keep requested preferences separate from verified settings. A model name in prompt text is not a backend selector; do not invent parameters or claim a named model or `max` was applied without evidence. Keep the user's conversation/text model unchanged.

Official OpenAI [image prompting guidance](https://developers.openai.com/api/docs/guides/image-prompting?model=gpt-image-2.5) recommends 2.6 Sunburst for demanding detail/layout/edit accuracy. The [image generation guide](https://developers.openai.com/api/docs/guides/image-generation) documents `max` quality for 2.6 and 2.5 Sunburst. These sources were checked on November 7, 2026; documentation alone does not establish account access or this tool's actual backend.

**Magnific is explicit opt-in only.** Do not use it as an automatic fallback, probe it or renew its login during routine ChatGPT work. The optional connection is documented in [INTEGRATION.md](INTEGRATION.md). A client without native ChatGPT image generation should prepare the exact source/reference/prompt handoff to a capable session, without automatically switching to a separately billed API or another provider.

## Production sequence

Composite 01 is supplied finished and is the highest appearance reference. Use
only it and the shared client-approved quality examples for appearance. Target
original PSDs control their own geometry and camera. Plan low-count crops
directly from all remaining source views, proportional to source size; then
generate and review the entire crop batch. Once every view's generated crops
passes review, notify the user to open Photoshop and assemble each view in order.
Assembly covers placement, masks, edge joins and shape checks, without manual
color/lighting adjustments. See `DIRECTIVES.md` for the complete contract.

## Records, scope and recovery

Respect authorized output counts and spending limits. Configuration/readiness work does not authorize generation. Estimate separately billed operations within their authorized scope. Record source/reference paths and hashes, exact prompts, requested versus actual settings, native output dimensions, versions and reviews. Resampling is not higher native generation quality.

Inspect local images before supplying them to the generator. Keep private receipts and signed URLs under ignored `.mrmak/sculpture-colorization/jobs/`. Resolve existing jobs before replacement after a timeout. Record reported errors without inventing their cause; authentication, allowance, moderation and unknown job states are distinct. Do not automatically repeat an unchanged moderated request.

Generation completion, agent review and user acceptance are separate states. Source-crop extraction alone does not mean the generated crop batch is complete; every required selected output must pass review before assembly. Keep all production records within the selected sculpture; reusable workflow files do not select or resume a prior job.
