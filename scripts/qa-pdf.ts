// QA harness for buildPlanPdf — runs under bun with project tsconfig paths.
import { writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).navigator = dom.window.navigator;
(globalThis as any).HTMLCanvasElement = dom.window.HTMLCanvasElement;
(globalThis as any).Image = dom.window.Image;
(globalThis as any).FileReader = dom.window.FileReader;
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 };
(globalThis as any).fetch = async () => ({ ok: false } as any);

const { buildPlanPdf } = await import('../src/utils/pdfBlob');

const brand = {
  companyName: 'Incline',
  tagline: 'Rise. Reflect. Repeat.',
  legalName: 'The Incline Life by Incline',
  website: 'theincline.in',
  supportEmail: 'hello@theincline.in',
  logoUrl: null,
  branch: { name: 'Incline — Indore', phone: '+91 90000 00000', email: 'hello@theincline.in' },
};

const workout = {
  name: 'Push / Pull / Legs Hypertrophy',
  type: 'workout' as const,
  member_name: 'Aarav Sharma',
  member_code: 'INC-00421',
  trainer_name: 'Coach Riya',
  goal: 'Muscle Gain',
  data: {
    days: [
      { day: 'Monday', focus: 'Push', exercises: [
        { name: 'Bench Press', equipment: 'Flat Bench Press Machine', sets: 4, reps: '8-10', rest: '90s', weight: '60kg', form_tips: ['Squeeze chest at top', 'Tuck elbows ~45°'] },
        { name: 'Shoulder Press', equipment: 'Smith Machine', sets: 3, reps: 10, rest: '60s', weight: '40kg', form_tips: 'Brace core' },
        { name: 'Triceps Pushdown', equipment: 'Cable Stack', sets: 3, reps: 12, rest: '45s', weight: '25kg' },
      ]},
      { day: 'Tuesday', focus: 'Pull', exercises: [
        { name: 'Lat Pulldown', equipment: 'Lat Pulldown Machine', sets: 4, reps: 10, rest: '75s', weight: '50kg' },
        { name: 'Seated Row', equipment: 'Cable Row Machine', sets: 4, reps: 10, rest: '75s' },
        { name: 'Bicep Curl', equipment: 'EZ Bar', sets: 3, reps: 12, rest: '45s', form_tips: ['No swinging'] },
      ]},
      { day: 'Wednesday', focus: 'Legs', exercises: [
        { name: 'Back Squat', equipment: 'Squat Rack', sets: 5, reps: 5, rest: '120s', weight: '80kg' },
        { name: 'Leg Press', equipment: 'Plate-Loaded Leg Press', sets: 4, reps: 12, rest: '90s' },
        { name: 'Leg Curl', equipment: 'Lying Leg Curl Machine', sets: 3, reps: 12, rest: '60s' },
      ]},
      { day: 'Thursday', exercises: [] },
    ],
  },
  notes: 'Add 2.5kg per week if RIR ≥ 2 on the last set.',
};

const diet = {
  name: 'High-Protein Indian Veg',
  type: 'diet' as const,
  member_name: 'Aarav Sharma',
  trainer_name: 'Coach Riya',
  goal: 'Lean Bulk',
  data: {
    hydration: '3.5 L water + 1 coconut water',
    supplements: ['Whey isolate (30g)', 'Creatine (5g)'],
    meals: [
      { meal: 'Breakfast', time: '8:00–9:00 AM', items: ['Oats', 'Banana', 'Greek yogurt'], calories: 480, protein: 32, carbs: 62, fats: 10, fiber: 8, sodium: 110, sugar: 18 },
      { meal: 'Mid-Morning', time: '11:00–11:30 AM', items: ['Apple', 'Almonds (20g)'], calories: 210, protein: 6, carbs: 24, fats: 12, fiber: 5, sodium: 5, sugar: 18 },
      { meal: 'Lunch', time: '1:30–2:30 PM', items: ['Brown rice', 'Rajma', 'Mixed salad', 'Curd'], calories: 720, protein: 36, carbs: 95, fats: 16, fiber: 14, sodium: 540, sugar: 8 },
      { meal: 'Pre-Workout', time: '5:00–5:30 PM', items: ['Banana', 'Black coffee'], calories: 120, protein: 2, carbs: 28, fats: 0, fiber: 3, sodium: 5, sugar: 14 },
      { meal: 'Post-Workout', time: '7:00–7:30 PM', items: ['Whey shake', 'Dates (3)'], calories: 230, protein: 28, carbs: 22, fats: 2, fiber: 2, sodium: 80, sugar: 18 },
      { meal: 'Dinner', time: '9:00–10:00 PM', items: ['Roti (3)', 'Paneer bhurji', 'Sauteed greens'], calories: 640, protein: 32, carbs: 60, fats: 24, fiber: 9, sodium: 480, sugar: 6 },
    ],
  },
};

for (const [name, input] of [['workout', workout], ['diet', diet]] as const) {
  const blob: Blob = await buildPlanPdf(input as any, brand as any);
  const buf = Buffer.from(await blob.arrayBuffer());
  writeFileSync(`/mnt/documents/qa-${name}.pdf`, buf);
  console.log(`wrote /mnt/documents/qa-${name}.pdf (${buf.length} bytes)`);
}
