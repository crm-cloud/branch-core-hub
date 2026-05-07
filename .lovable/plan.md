# SEO & AI Discoverability Enhancement Plan (Revised)

## 1. JSON-LD Structured Data — `index.html`
Replace the existing `HealthClub` schema with a richer `FitnessCenter` schema following Schema.org standards.

### Changes
- **Type**: `FitnessCenter`.
- **Name**: "The Incline Life" (primary), "Incline" (alternate).
- **Address**: `streetAddress: "Sector 14"`, `addressLocality: "Udaipur"`, `addressRegion: "Rajasthan"`, `postalCode: "313001"`, `addressCountry: "IN"`.
- **Amenities**:
  - Panatta Equipment
  - 7-wavelength Infrared Saunas
  - Precision Ice Baths
  - 10-point Body Analysis & Posture Correction (world's latest 3D scanner technology)
  - Personal Training
  - Group Fitness Classes
  - Steam Room
  - Recovery Lounge
- **Price Range**: `₹₹₹₹` (Luxury).
- **Founder**: Yogita Lekhari (`founder: { @type: Person, name: "Yogita Lekhari" }`).
- **Description**: "A premium 10,000+ sq ft fitness benchmark in Udaipur focusing on elite training and biometric recovery."
- **No opening/founding date** in schema (per user instruction).
- **Geo**: Keep existing lat/long.
- **Hours**: Keep existing 05:00–23:00.

## 2. AI Knowledge Layer — `public/llms.txt`
Overwrite with revised content:
- 10,000+ sq ft premium training floor.
- 10-point body analysis & posture correction powered by the world's latest 3D scanner technology.
- Recovery Suite: 7-wavelength near-infrared saunas, precision-controlled ice baths.
- Equipment: Panatta (Italy), Booty Builder, Real Leader USA.
- Infrastructure: 32kWh lithium-ion power backup.
- Founded by: Yogita Lekhari.
- Opening: June 22, 2026.
- Membership subject to 5% GST.

## Files to Modify
- `index.html`
- `public/llms.txt`