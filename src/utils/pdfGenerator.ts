// PDF generation utility for fitness plans

interface PlanData {
  name: string;
  description?: string;
  type: 'workout' | 'diet';
  data: any;
  validFrom?: string;
  validUntil?: string;
  caloriesTarget?: number;
}

export function generatePlanPDF(plan: PlanData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download PDF');
    return;
  }

  const isWorkout = plan.type === 'workout';
  const planData = plan.data || {};

  let contentHTML = '';

  if (isWorkout) {
    contentHTML = generateWorkoutContent(planData);
  } else {
    contentHTML = generateDietContent(planData, plan.caloriesTarget);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${plan.name} - ${isWorkout ? 'Workout' : 'Diet'} Plan</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          padding: 40px;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #6366f1;
        }
        .header h1 {
          color: #6366f1;
          font-size: 28px;
          margin-bottom: 8px;
        }
        .header p {
          color: #666;
          font-size: 14px;
        }
        .meta {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 25px;
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }
        .meta-item {
          font-size: 13px;
        }
        .meta-item strong {
          color: #6366f1;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 18px;
          color: #6366f1;
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        .day-card {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
        }
        .day-title {
          font-weight: 600;
          color: #333;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .exercise-list, .meal-list {
          list-style: none;
        }
        .exercise-list li, .meal-list li {
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
        }
        .exercise-list li:last-child, .meal-list li:last-child {
          border-bottom: none;
        }
        .exercise-detail {
          color: #666;
          font-size: 12px;
          margin-top: 3px;
        }
        .calories-badge {
          background: #6366f1;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          margin-left: 8px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
          color: #999;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        @media print {
          body { padding: 20px; }
          .day-card { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${plan.name}</h1>
        <p>${plan.description || (isWorkout ? 'Personalized Workout Plan' : 'Personalized Diet Plan')}</p>
      </div>
      
      <div class="meta">
        <div class="meta-item"><strong>Type:</strong> ${isWorkout ? 'Workout Plan' : 'Diet Plan'}</div>
        ${plan.validFrom ? `<div class="meta-item"><strong>Start:</strong> ${new Date(plan.validFrom).toLocaleDateString()}</div>` : ''}
        ${plan.validUntil ? `<div class="meta-item"><strong>End:</strong> ${new Date(plan.validUntil).toLocaleDateString()}</div>` : ''}
        ${plan.caloriesTarget ? `<div class="meta-item"><strong>Daily Calories:</strong> ${plan.caloriesTarget} kcal</div>` : ''}
      </div>

      ${contentHTML}

      <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString()} • This plan is personalized for you</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print();
  };
}

function generateWorkoutContent(data: any): string {
  let html = '';
  
  if (data.days && Array.isArray(data.days)) {
    html += '<div class="section">';
    html += '<h2 class="section-title">Weekly Schedule</h2>';
    
    data.days.forEach((day: any, index: number) => {
      html += `
        <div class="day-card">
          <div class="day-title">${day.name || `Day ${index + 1}`}</div>
          <ul class="exercise-list">
      `;
      
      if (day.exercises && Array.isArray(day.exercises)) {
        day.exercises.forEach((exercise: any) => {
          html += `
            <li>
              <strong>${exercise.name || exercise}</strong>
              ${exercise.sets ? `<div class="exercise-detail">${exercise.sets} sets × ${exercise.reps} reps ${exercise.weight ? `@ ${exercise.weight}` : ''}</div>` : ''}
            </li>
          `;
        });
      }
      
      html += '</ul></div>';
    });
    
    html += '</div>';
  } else if (data.exercises && Array.isArray(data.exercises)) {
    html += '<div class="section">';
    html += '<h2 class="section-title">Exercises</h2>';
    html += '<div class="day-card"><ul class="exercise-list">';
    
    data.exercises.forEach((exercise: any) => {
      const name = typeof exercise === 'string' ? exercise : exercise.name;
      html += `<li><strong>${name}</strong></li>`;
    });
    
    html += '</ul></div></div>';
  } else {
    html += '<div class="section"><p>No workout details available</p></div>';
  }
  
  return html;
}

function generateDietContent(data: any, caloriesTarget?: number): string {
  let html = '';
  
  if (caloriesTarget) {
    html += `
      <div class="section">
        <h2 class="section-title">Daily Target</h2>
        <div class="day-card">
          <p><strong>Calories:</strong> ${caloriesTarget} kcal/day</p>
        </div>
      </div>
    `;
  }
  
  const meals = data.meals || data;
  
  if (meals && typeof meals === 'object') {
    html += '<div class="section">';
    html += '<h2 class="section-title">Meal Plan</h2>';
    
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    mealTypes.forEach((mealType) => {
      const mealData = meals[mealType];
      if (mealData) {
        html += `
          <div class="day-card">
            <div class="day-title">${mealType.charAt(0).toUpperCase() + mealType.slice(1)}</div>
            <ul class="meal-list">
        `;
        
        if (Array.isArray(mealData)) {
          mealData.forEach((item: any) => {
            const name = typeof item === 'string' ? item : item.name;
            const calories = typeof item === 'object' ? item.calories : null;
            html += `<li>${name}${calories ? `<span class="calories-badge">${calories} kcal</span>` : ''}</li>`;
          });
        } else if (typeof mealData === 'string') {
          html += `<li>${mealData}</li>`;
        }
        
        html += '</ul></div>';
      }
    });
    
    html += '</div>';
  } else {
    html += '<div class="section"><p>No diet details available</p></div>';
  }
  
  return html;
}
