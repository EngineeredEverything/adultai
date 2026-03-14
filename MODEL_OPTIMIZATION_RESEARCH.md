# Model Optimization Research & Settings

**Last Updated:** 2026-03-14
**Research Sources:** Civitai official pages, Hugging Face documentation, Reddit communities, GitHub repos
**Status:** All 5 core models have research-backed optimal defaults

---

## Summary Table

| Model | Steps | CFG | Sampler | Clip Skip | Best For | Architecture |
|-------|-------|-----|---------|-----------|----------|--------------|
| **CyberRealistic Pony v16** | 35 | 5.0 | DPM++ SDE Karras | 2 | Cinematic photorealism, portraits, skin detail | SDXL (Pony) |
| **Pony Realism v2.2** | 35 | 6.5 | Euler a | 2 | Hyper-detailed skin texture, anatomy | SDXL (Pony) |
| **Lustify v7** | 32 | 6.0 | DPM++ 2M SDE | 1 | NSFW photorealism, explicit detail | SDXL |
| **DAMN! v5** | 36 | 5.0 | DPM++ 2M SDE | 1 | Diverse artistic styles, anatomy | Illustrious |
| **Pony Diffusion V6 XL** | 28 | 7.5 | Euler a | 2 | Fantasy creatures, anthro, furry | SDXL (Pony) |

---

## Model-by-Model Details

### 1. CyberRealistic Pony v16 (Default)

**Official Source:** https://civitai.com/models/443821/cyberrealistic-pony

**Official Recommendation (from Civitai page):**
> "Sampling method: DPM++ SDE Karras / DPM++ 2M Karras / Euler a  
> Sampling steps: **30+ Steps**  
> Resolution: 896x1152 / 832x1216  
> CFG: **5**  
> Clip Skip: **2**"

**Community Consensus (Reddit):**
- Works well with 30-50 steps, CFG 4-7
- DPM++ SDE Karras is preferred for speed + quality balance
- Best results at 832x1216 or 896x1152
- Clip skip 2 is standard

**Our Settings:**
```
steps: 35
cfg: 5
sampler: dpmpp_sde_karras
clip_skip: 2
hires_fix: 1.5x scale (55% denoise)
```

**Why:** 35 steps hits the "30+" minimum with headroom for hires fix. CFG 5 is official. DPM++ SDE Karras balances quality and speed.

---

### 2. Pony Realism v2.2

**Official Source:** https://civitai.com/models/372465/pony-realism

**Hugging Face Benchmark (realDream_sdxlPony13):**
> "Pony SDXL: Use the "Euler a" or "DPM++ SDE Karras" sampler with **20-30 steps** for better quality."

**Civitai Article (Sampler Reference):**
> "Recipe: **30 steps, CFG 7, Euler sampler**, normal scheduler, 512×512"

**Reddit Community:**
- Euler a or DPM++ 2S a Karras preferred
- CFG 6.5-7 prevents oversaturation
- Clip skip 2 standard for Pony models
- 12+ steps with DPM++ SDE can match 30+ with Euler

**Our Settings:**
```
steps: 35
cfg: 6.5
sampler: euler_a
clip_skip: 2
hires_fix: 1.5x scale (55% denoise)
```

**Why:** Higher CFG (6.5) than CyberRealistic to prevent oversaturation. Euler a is preferred by community for detail. 35 steps ensures quality.

---

### 3. Lustify v7 (SDXL NSFW)

**Official Source:** https://civitai.com/models/573152/lustify-sdxl-nsfw-checkpoint

**Hugging Face Documentation (Lustify v2.0):**
> "Recommended parameters:  
> Sampler: **DPM++ 2M SDE/DPM++ 3M SDE**, Scheduler: Exponential/Karras  
> **Steps: 30**  
> **Cfg: 4-7** (lower = more realistic, higher = more stylized)  
> Highres.fix: upscale by 1.4-1.5, denoising ~0.4"

**Civitai Article (Best SDXL Sampler):**
> "Works better at **lower CFG 5-7**"

**Our Settings:**
```
steps: 32
cfg: 6.0
sampler: dpmpp_2m_sde
clip_skip: 1
hires_fix: 1.4x scale (55% denoise)
```

**Why:** 32 steps for quality in SDXL. CFG 6 balances realism + adherence. DPM++ 2M SDE is official recommendation. Clip skip 1 (SDXL standard, not Pony).

---

### 4. DAMN! v5 (Illustrious Base)

**Official Source:** https://civitai.com/models/428826/damn-illustriouspony-realistic-model

**Official Recommendation (from Civitai page):**
> "RECOMMENDED PARAMETERS FOR BEST RESULTS:  
> ◦ Sampler: DPM++ 2M SDE / DPM++ 3M SDE / DPM++ SDE  
> ◦ **30-40 Steps**  
> ◦ **CFG: 3-6** (low for more realism, high for more stylization)"

**Civitai Sampler Reference (Illustrious):**
> "Illustrious's official guide: "Euler a is recommended in general (**20–28 steps, CFG 5–7**)"

**Critical Note:** DAMN! is **Illustrious base**, NOT Pony.  
- Do NOT use Pony LoRAs
- Score_ tags have NO effect (Illustrious doesn't respond to them)
- Use: "masterpiece, best quality, realistic" instead

**Our Settings:**
```
steps: 36
cfg: 5.0
sampler: dpmpp_2m_sde
clip_skip: 1
hires_fix: 1.5x scale (55% denoise)
```

**Why:** 36 steps uses DAMN!'s recommended 30-40 range. CFG 5 balances realism (3) + stylization (6). DPM++ 2M SDE is official. Clip skip 1 (Illustrious standard).

---

### 5. Pony Diffusion V6 XL

**Official Source:** https://civitai.com/models/257749/pony-diffusion-v6-xl

**Civitai Official (from page):**
> "Using Euler a with **25 steps** and resolution of 1024px is recommended although model generally can do most supported SDXL resolution"

**Civitai Article (Pony V6 Working Notes):**
> "**resolution ~1024px, 25 steps, CFG ~7, sampler DPM++ 2M (or Euler a), CLIP skip 2**  
> Euler a \\ CFG Scale: 7-9 \\ Steps: 25-30, 45"

**Stable Diffusion Art:**
> "All Pony models work best when using **Euler sampler**"

**Our Settings:**
```
steps: 28
cfg: 7.5
sampler: euler_a
clip_skip: 2
hires_fix: 1.5x scale (55% denoise)
```

**Why:** 28 steps is in the 25-30 recommended range. CFG 7.5 is mid-range of 7-9 official. Euler a is community preference for Pony. Clip skip 2 (Pony standard).

---

## Quality Prefix Tags (GPU Auto-Injection)

The GPU API automatically injects quality prefixes based on model type:

### Pony Models (CyberRealistic, Pony Realism, Pony Diffusion)
```
"score_9, score_8_up, score_7_up, source_realistic, photorealistic, "
```
- Tells the model to aim for high-quality compositions
- Works with Danbooru/Pony tag vocabulary

### Pony Diffusion V6 XL (Fantasy)
```
"score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up, rating_explicit, "
```
- Full score chain for maximum quality + rating_explicit for NSFW

### Illustrious (DAMN!)
```
"masterpiece, best quality, realistic, "
```
- Score_ tags have no effect on Illustrious
- Illustrious responds to "masterpiece, best quality" instead

### Lustify (SDXL)
```
"best quality, masterpiece, "
```
- Standard SDXL quality prompts

---

## Hires Fix Settings (Upscaling)

All models use consistent hires fix strategy:
- **Scale:** 1.4-1.5x (1.4 for Lustify, 1.5 for Pony models)
- **Denoise:** ~0.35 (0.3 for Pony Diffusion fantasy)
- **Steps:** ~55% of base steps

This allows 832x1216 base generation → 1248x1824 upscaled output in real-time.

---

## Negative Prompts

### NEGATIVE_PONY_REALISTIC (Photorealistic Pony models)
Used for: CyberRealistic, Pony Realism, Lustify, DAMN!
```
"(worst quality, low quality:1.4), blurry, bad anatomy, muscular, watermark, text, ...[full list in config.ts]"
```

### NEGATIVE_PONY_FANTASY (Pony Diffusion)
Used for: Pony Diffusion V6 XL
```
"(worst quality, low quality:1.4), blurry, censored, watermark, ...[full list in config.ts]"
```

---

## Implementation Timeline

**2026-02-20:** Model configs rewritten with Civitai-backed settings  
**2026-03-09:** Multi-model support deployed; CyberRealistic Pony set as default  
**2026-03-14:** Full research audit completed; all model settings optimized

---

## How Settings Are Applied

1. **User selects a model** on website or advanced form
2. **MODEL_DEFAULTS** / **MODEL_OPTION_DEFAULTS** auto-loads:
   - steps, cfg, sampler
   - hires_fix, hires_scale, hires_denoise
3. **User can override** any setting (defaults are suggestions)
4. **GPU API** receives final settings + applies quality prefixes + negatives per model
5. **Output quality** improves from consistent, researched parameters

---

## Future Improvements

- [ ] A/B test user satisfaction by model (vote data → learning loop)
- [ ] Add resolution recommendations per model (832x1216 vs 1024x1024)
- [ ] Season/theme adjustments (holiday specials, trending aesthetics)
- [ ] Per-prompt-category fine-tuning (outdoor vs indoor lighting preferences)
- [ ] Community feedback loop (users suggest CFG/steps that worked well)

---

## References

- [CyberRealistic Pony v16 - Civitai](https://civitai.com/models/443821/cyberrealistic-pony)
- [Pony Realism v2.2 - Civitai](https://civitai.com/models/372465/pony-realism)
- [DAMN! v5 - Civitai](https://civitai.com/models/428826/damn-illustriouspony-realistic-model)
- [Lustify v7 - Civitai](https://civitai.com/models/573152/lustify-sdxl-nsfw-checkpoint)
- [Pony Diffusion V6 XL - Civitai](https://civitai.com/models/257749/pony-diffusion-v6-xl)
- [Sampler Reference - Civitai](https://civitai.com/articles/16231/sampler-and-scheduler-reference-for-hi-dream-flux-sdxl-illustrious-and-pony)
- [Lustify v2.0 - Hugging Face](https://huggingface.co/TheImposterImposters/LUSTIFY-v2.0)
- [Pony SDXL Benchmarks - Hugging Face](https://huggingface.co/LyliaEngine/realDream_sdxlPony13)
- [Pony V6 XL - Stable Diffusion Art](https://stable-diffusion-art.com/pony-diffusion-v6-xl/)
