// QA-only PDF render with shimmed browser globals.
(globalThis as any).localStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{}, clear:()=>{}, key:()=>null, length:0 };
(globalThis as any).window = globalThis;
(globalThis as any).document = { createElement:()=>({ style:{}, setAttribute:()=>{}, addEventListener:()=>{}, click:()=>{} }), body:{appendChild:()=>{},removeChild:()=>{}} };

import { writeFileSync } from 'node:fs';
const { buildPlanPdf } = await import('@/utils/pdfBlob');

const brand: any = { companyName:'Incline Fitness', legalName:'The Incline Life by Incline', website:'theincline.in', supportEmail:'support@theincline.in', branch:{ name:'Incline HSR', address:'HSR Layout, Bengaluru', phone:'+91 98765 43210', email:'hsr@theincline.in' } };

const workout: any = { name:'Hypertrophy Build — 4 Week', type:'workout', member_name:'Jawahar Reddy', member_code:'INC-1042', trainer_name:'Coach Arjun', goal:'Muscle gain', validFrom:'2026-05-12', validUntil:'2026-06-09', notes:'Warm-up 8 min on treadmill. Stretch 5 min post-workout.', data:{ weeks:[{ week:1, days:[
  { day:'Monday — Push', exercises:[{name:'Barbell Bench Press',sets:4,reps:'6-8',rest:'120s'},{name:'Incline Dumbbell Press',sets:3,reps:'8-10',rest:'90s'},{name:'Cable Chest Fly',sets:3,reps:'12-15',rest:'60s'},{name:'Overhead Shoulder Press',sets:4,reps:'6-8',rest:'120s'},{name:'Lateral Raise',sets:3,reps:'12-15',rest:'60s'},{name:'Tricep Pushdown',sets:3,reps:'10-12',rest:'60s'}]},
  { day:'Tuesday — Pull', exercises:[{name:'Deadlift',sets:4,reps:'5',rest:'180s'},{name:'Pull-up',sets:4,reps:'6-10',rest:'120s'},{name:'Barbell Row',sets:3,reps:'8-10',rest:'90s'},{name:'Face Pull',sets:3,reps:'15',rest:'60s'},{name:'Bicep Curl',sets:3,reps:'10-12',rest:'60s'}]},
  { day:'Wednesday', exercises:[] },
  { day:'Thursday — Legs', exercises:[{name:'Back Squat',sets:4,reps:'6-8',rest:'180s'},{name:'Romanian Deadlift',sets:3,reps:'8-10',rest:'120s'},{name:'Leg Press',sets:3,reps:'10-12',rest:'90s'},{name:'Hip Thrust',sets:3,reps:'10-12',rest:'90s'},{name:'Standing Calf Raise',sets:4,reps:'12-15',rest:'60s'}]},
]}]}};

const diet: any = { name:'Lean Cut — 2200 kcal', type:'diet', member_name:'Jawahar Reddy', member_code:'INC-1042', trainer_name:'Coach Arjun', goal:'Fat loss', caloriesTarget:2200, validFrom:'2026-05-12', validUntil:'2026-06-09', notes:'Drink 3.5 L water/day. Black coffee allowed pre-workout.', data:{ meals:[
  { meal:'Breakfast', time:'7:30 AM', items:['4 egg white omelette','Oats 60g with berries','Black coffee'], calories:480 },
  { meal:'Mid-morning', time:'11:00 AM', items:['Greek yogurt 200g','1 apple'], calories:220 },
  { meal:'Lunch', time:'1:30 PM', items:['Grilled chicken 180g','Brown rice 100g','Mixed salad with olive oil'], calories:620 },
  { meal:'Pre-workout', time:'5:00 PM', items:['Banana','1 scoop whey'], calories:250 },
  { meal:'Post-workout', time:'7:00 PM', items:['Whey isolate 1 scoop','1 small sweet potato'], calories:280 },
  { meal:'Dinner', time:'8:30 PM', items:['Grilled fish 180g','Quinoa 80g','Sauteed greens'], calories:550 },
]}};

const w = buildPlanPdf(workout, brand);
const d = buildPlanPdf(diet, brand);
writeFileSync('/tmp/qa-workout.pdf', Buffer.from(await w.arrayBuffer()));
writeFileSync('/tmp/qa-diet.pdf', Buffer.from(await d.arrayBuffer()));
console.log('OK');
