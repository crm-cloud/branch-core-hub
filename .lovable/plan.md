# Pre-fill Full 16-Clause Membership Terms & Conditions

## Goal
Replace the existing 10-item `DEFAULT_TERMS` array in `MemberRegistrationForm.tsx` with the full 16-clause "Fitness Centre – Membership Terms & Conditions" document supplied. Custom Terms (Optional) stays a free-text addendum that gets appended.

## Changes — single file: `src/components/members/MemberRegistrationForm.tsx`

### 1. Replace `DEFAULT_TERMS` (lines 50–61)
Convert from a flat 10-string array into a structured 16-clause array so each clause keeps its title + body. Each entry becomes:
```ts
{ title: 'Health Declaration & Assumption of Risk', body: 'I confirm that I am medically fit ...' }
```
Sections covered (1–16): Health Declaration, Medical Disclosure, Code of Conduct, Membership Usage, Fees/Taxes (5% GST, non-refundable), Freeze/Pause, Personal Training Policy, Equipment Damage, Lockers, Supplements, CCTV (₹200 retrieval fee), Data Protection, Emergency Medical Consent, Indemnity, Rules & Amendments, Dispute Resolution.

### 2. Update the helper hint (line 447)
Change `{DEFAULT_TERMS.length} standard terms will be included automatically` → `16 standard membership terms & conditions will be included automatically. Use the field below only for member-specific addendums.`

### 3. Update jsPDF rendering (lines 600–614)
Render each clause as bold title line + wrapped body paragraph, so the printed PDF reads like a real T&C document instead of a numbered one-liner list. Custom term still appended at the end as clause 17 if present. Add page-break check per clause.

### 4. Update HTML preview/print (line 316)
Switch the inline `<ol><li>{t}</li></ol>` rendering to render each clause with `<li><strong>{title}</strong><br/>{body}</li>` plus a final "Member Declaration" block:
```
I have read, understood, and agree to abide by all the terms and conditions stated above.
Member Name / Signature / Date
```

### 5. Update legacy `printRegistrationForm` (line 719)
Same structured rendering as above so the fallback print path matches.

## Out of scope
- No schema changes.
- Custom Terms textarea behavior unchanged (still optional, appended).
- Signature canvas, pre-filled Fitness Goals / Medical Conditions / Government ID logic untouched.
- Brand footer line `The Incline Life by Incline` already present — kept.

## Files
- `src/components/members/MemberRegistrationForm.tsx`
