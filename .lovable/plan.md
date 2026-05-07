# SEO & AI Discoverability Enhancement Plan

## 1. JSON-LD Structured Data — `index.html`
Replace the existing `HealthClub` schema with a richer `FitnessCenter` schema following Schema.org standards.

### Changes
- **Type**: Switch `@type` from `HealthClub` to `FitnessCenter`.
- **Name**: "The Incline Life" (primary), "Incline" (alternate).
- **Address**: Add `streetAddress: "Sector 14"`, `postalCode: "313001"`, keep `addressLocality: "Udaipur"`, `addressRegion: "Rajasthan"`, `addressCountry: "IN"`.
- **Amenities**: Replace generic list with specific entity-focused features:
  - Panatta Equipment
  - 7-wavelength Infrared Saunas
  - Precision Ice Baths
  - Howbody 3D Scanners
  - Personal Training
  - Group Fitness Classes
- **Price Range**: Update from `₹₹₹` to `₹₹₹₹` (Luxury).
- **Opening Date**: Add `foundingDate: "2026-06-22"`.
- **Description**: Add `description` field: "A premium 9,000-square-foot fitness benchmark in Udaipur focusing on elite training and biometric recovery."
- **Geo Coordinates**: Keep existing lat/long (24.5854, 73.7125).
- **Opening Hours**: Keep existing 05:00-23:00 daily.
- **Image / URL**: Keep existing.
- Preserve the existing `Organization` and `WebSite` schemas above and below it.

## 2. AI Knowledge Layer — `public/llms.txt`
Overwrite the existing file with the user-supplied content so AI crawlers (Google Gemini, OpenAI, Anthropic) ingest the precise business summary.

### New content includes
- Business identity and location (Sector 14, Udaipur, Rajasthan).
- Key technical features: 9,000 sq ft floor, Howbody 3D scanning, 7-wavelength near-infrared saunas, precision ice baths, Panatta / Booty Builder / Real Leader equipment, 32kWh lithium-ion backup.
- Founder: Rajat Lekhari.
- Opening: June 22, 2026.
- Services subject to 5% GST.

## 3. Out-of-Scope (User Actions Required)
The following items cannot be implemented in code and must be done externally by the user:
- **Google Business Profile (GBP)**: Add Products (e.g., "Panatta Plate Loaded Series") and Services (e.g., "3D Posture Analysis"). Ensure NAP consistency.
- **PR / Authority Mentions**: Publish news articles mentioning "Fitness in Udaipur" and "Incline" together.
- **Competitive Gap Strategy**: Continue emphasizing recovery-focused fitness (saunas, ice baths) on homepage content.

## Files to Modify
- `index.html` — update JSON-LD block.
- `public/llms.txt` — full replacement.

No new dependencies or backend changes required.