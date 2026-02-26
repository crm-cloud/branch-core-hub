import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('Starting comprehensive seed data creation...');

    // ==================== BRANCH ====================
    const { data: existingBranch } = await supabase
      .from('branches')
      .select('id')
      .eq('code', 'MAIN')
      .single();

    let branchId = existingBranch?.id;

    if (!branchId) {
      const { data: newBranch, error: branchError } = await supabase
        .from('branches')
        .insert({
          name: 'Main Branch',
          code: 'MAIN',
          address: '123 Fitness Street, Andheri West',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postal_code: '400058',
          phone: '+91 22 1234 5678',
          email: 'main@inclinefitness.in',
          opening_time: '05:00',
          closing_time: '23:00',
          timezone: 'Asia/Kolkata',
          is_active: true,
        })
        .select()
        .single();

      if (branchError) {
        console.error('Branch creation error:', branchError);
        throw branchError;
      }
      branchId = newBranch.id;
      console.log('Created branch:', branchId);
    }

    // Create branch settings
    const { error: branchSettingsError } = await supabase
      .from('branch_settings')
      .upsert({
        branch_id: branchId,
        currency: 'INR',
        tax_rate: 18,
        late_fee_rate: 5,
        freeze_min_days: 7,
        freeze_max_days: 30,
        freeze_fee: 500,
        advance_booking_days: 7,
        auto_attendance_checkout: true,
        checkout_after_hours: 4,
        waitlist_enabled: true,
        cancellation_fee_rate: 10,
      }, { onConflict: 'branch_id' });

    if (branchSettingsError) {
      console.error('Branch settings error:', branchSettingsError);
    } else {
      console.log('Branch settings configured');
    }

    // ==================== USERS ====================
    const testUsers = [
      { email: 'neha.verma@test.com', full_name: 'Neha Verma', phone: '9876543201', role: 'manager', gender: 'female', dob: '1990-05-15' },
      { email: 'amit.kumar@test.com', full_name: 'Amit Kumar', phone: '9876543202', role: 'staff', gender: 'male', dob: '1995-08-22' },
      { email: 'sanjay.mishra@test.com', full_name: 'Sanjay Mishra', phone: '9876543220', role: 'staff', gender: 'male', dob: '1992-03-10' },
      { email: 'vikram.singh@test.com', full_name: 'Vikram Singh', phone: '9876543203', role: 'trainer', gender: 'male', dob: '1988-11-30' },
      { email: 'anjali.gupta@test.com', full_name: 'Anjali Gupta', phone: '9876543204', role: 'trainer', gender: 'female', dob: '1992-02-14' },
      { email: 'rohit.nair@test.com', full_name: 'Rohit Nair', phone: '9876543221', role: 'trainer', gender: 'male', dob: '1990-07-25' },
      { email: 'rahul.sharma@test.com', full_name: 'Rahul Sharma', phone: '9876543205', role: 'member', gender: 'male', dob: '1993-04-18' },
      { email: 'priya.patel@test.com', full_name: 'Priya Patel', phone: '9876543206', role: 'member', gender: 'female', dob: '1995-09-12' },
      { email: 'arjun.reddy@test.com', full_name: 'Arjun Reddy', phone: '9876543207', role: 'member', gender: 'male', dob: '1991-12-05' },
      { email: 'kavita.iyer@test.com', full_name: 'Kavita Iyer', phone: '9876543208', role: 'member', gender: 'female', dob: '1994-06-28' },
      { email: 'deepak.joshi@test.com', full_name: 'Deepak Joshi', phone: '9876543209', role: 'member', gender: 'male', dob: '1989-01-15' },
      { email: 'meera.krishna@test.com', full_name: 'Meera Krishna', phone: '9876543210', role: 'member', gender: 'female', dob: '1996-10-20' },
      { email: 'suresh.menon@test.com', full_name: 'Suresh Menon', phone: '9876543211', role: 'member', gender: 'male', dob: '1987-03-08' },
      { email: 'pooja.desai@test.com', full_name: 'Pooja Desai', phone: '9876543212', role: 'member', gender: 'female', dob: '1993-07-14' },
      { email: 'karthik.rao@test.com', full_name: 'Karthik Rao', phone: '9876543213', role: 'member', gender: 'male', dob: '1990-11-22' },
      { email: 'ananya.das@test.com', full_name: 'Ananya Das', phone: '9876543214', role: 'member', gender: 'female', dob: '1997-02-28' },
    ];

    const createdUsers: any[] = [];

    for (const user of testUsers) {
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const userExists = existingUser?.users?.find(u => u.email === user.email);

      if (userExists) {
        console.log(`User ${user.email} already exists, skipping auth creation...`);
        createdUsers.push({ ...user, id: userExists.id });
        continue;
      }

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: 'Test@123',
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name,
          phone: user.phone,
        },
      });

      if (authError) {
        console.error(`Error creating user ${user.email}:`, authError);
        continue;
      }

      console.log(`Created auth user: ${user.email}`);

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authUser.user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
        }, { onConflict: 'id' });

      if (profileError) {
        console.error(`Profile upsert error for ${user.email}:`, profileError);
      }

      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: authUser.user.id,
          role: user.role,
        }, { onConflict: 'user_id,role' });

      if (roleError) {
        console.error(`Role insert error for ${user.email}:`, roleError);
      } else {
        console.log(`Assigned role '${user.role}' to ${user.email}`);
      }

      createdUsers.push({ ...user, id: authUser.user.id });
    }

    // ==================== BENEFIT TYPES (Dynamic Benefits) ====================
    const benefitTypes = [
      { name: 'Ice Bath', code: 'ICE_BATH', is_bookable: true, default_duration_minutes: 15, icon: 'snowflake', category: 'wellness', description: 'Cold therapy for muscle recovery' },
      { name: 'Sauna', code: 'SAUNA', is_bookable: true, default_duration_minutes: 30, icon: 'thermometer', category: 'wellness', description: 'Traditional Finnish sauna' },
      { name: 'Steam Room', code: 'STEAM_ROOM', is_bookable: true, default_duration_minutes: 20, icon: 'cloud', category: 'wellness', description: 'Wet steam therapy room' },
      { name: 'Swimming Pool', code: 'POOL', is_bookable: true, default_duration_minutes: 60, icon: 'waves', category: 'fitness', description: 'Olympic-size swimming pool access' },
      { name: 'Spa Treatment', code: 'SPA', is_bookable: true, default_duration_minutes: 60, icon: 'sparkles', category: 'wellness', description: 'Professional spa and massage services' },
      { name: 'Locker', code: 'LOCKER', is_bookable: false, icon: 'lock', category: 'facility', description: 'Personal locker access' },
      { name: 'Towel Service', code: 'TOWEL', is_bookable: false, icon: 'bath', category: 'facility', description: 'Fresh towel provided daily' },
      { name: 'Parking', code: 'PARKING', is_bookable: false, icon: 'car', category: 'facility', description: 'Reserved parking spot' },
      { name: 'Group Classes', code: 'GROUP_CLASSES', is_bookable: false, icon: 'users', category: 'fitness', description: 'Unlimited group fitness classes' },
      { name: 'Personal Training Session', code: 'PT_SESSION', is_bookable: true, default_duration_minutes: 60, icon: 'dumbbell', category: 'fitness', description: 'One-on-one training session' },
    ];

    const createdBenefitTypes: any[] = [];
    for (const bt of benefitTypes) {
      const { data: existingBt } = await supabase
        .from('benefit_types')
        .select('id')
        .eq('code', bt.code)
        .eq('branch_id', branchId)
        .single();

      if (existingBt) {
        createdBenefitTypes.push({ ...bt, id: existingBt.id });
        console.log(`Benefit type ${bt.name} already exists`);
        continue;
      }

      const { data: newBt, error: btError } = await supabase
        .from('benefit_types')
        .insert({
          branch_id: branchId,
          ...bt,
          is_active: true,
        })
        .select()
        .single();

      if (btError) {
        console.error(`Benefit type creation error for ${bt.name}:`, btError);
      } else {
        createdBenefitTypes.push(newBt);
        console.log(`Created benefit type: ${bt.name}`);
      }
    }

    // ==================== BENEFIT SETTINGS ====================
    const bookableBenefits = createdBenefitTypes.filter(bt => bt.is_bookable);
    for (const bt of bookableBenefits) {
      const { error: settingsError } = await supabase
        .from('benefit_settings')
        .upsert({
          branch_id: branchId,
          benefit_type: bt.code,
          benefit_type_id: bt.id,
          is_slot_booking_enabled: true,
          slot_duration_minutes: bt.default_duration_minutes || 30,
          capacity_per_slot: bt.code === 'POOL' ? 20 : bt.code === 'PT_SESSION' ? 1 : 5,
          operating_hours_start: '06:00',
          operating_hours_end: '22:00',
          booking_opens_hours_before: 24,
          max_bookings_per_day: 2,
          cancellation_deadline_minutes: 60,
          buffer_between_sessions_minutes: 10,
          no_show_policy: 'deduct_credit',
          no_show_penalty_amount: 100,
        }, { onConflict: 'branch_id,benefit_type' });

      if (settingsError) {
        console.error(`Benefit settings error for ${bt.name}:`, settingsError);
      } else {
        console.log(`Created settings for: ${bt.name}`);
      }
    }

    // ==================== BENEFIT SLOTS (Next 7 days) ====================
    const today = new Date();
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const slotDate = new Date(today);
      slotDate.setDate(today.getDate() + dayOffset);
      const dateStr = slotDate.toISOString().split('T')[0];

      for (const bt of bookableBenefits) {
        const slotTimes = [
          { start: '06:00', end: '07:00' },
          { start: '07:00', end: '08:00' },
          { start: '08:00', end: '09:00' },
          { start: '09:00', end: '10:00' },
          { start: '10:00', end: '11:00' },
          { start: '14:00', end: '15:00' },
          { start: '15:00', end: '16:00' },
          { start: '16:00', end: '17:00' },
          { start: '17:00', end: '18:00' },
          { start: '18:00', end: '19:00' },
          { start: '19:00', end: '20:00' },
          { start: '20:00', end: '21:00' },
        ];

        for (const slot of slotTimes) {
          const { error: slotError } = await supabase
            .from('benefit_slots')
            .upsert({
              branch_id: branchId,
              benefit_type: bt.code,
              benefit_type_id: bt.id,
              slot_date: dateStr,
              start_time: slot.start,
              end_time: slot.end,
              capacity: bt.code === 'POOL' ? 20 : bt.code === 'PT_SESSION' ? 1 : 5,
              booked_count: 0,
              is_active: true,
            }, { onConflict: 'branch_id,benefit_type,slot_date,start_time' });

          if (slotError && !slotError.message.includes('duplicate')) {
            console.error(`Slot creation error:`, slotError);
          }
        }
      }
    }
    console.log('Created benefit slots for next 7 days');

    // ==================== TRAINERS ====================
    const trainers = createdUsers.filter(u => u.role === 'trainer');
    const trainerSpecializations = [
      ['Strength Training', 'HIIT', 'Functional Training', 'Weight Loss'],
      ['Yoga', 'Pilates', 'Flexibility', 'Meditation'],
      ['CrossFit', 'Olympic Lifting', 'Endurance', 'Sports Conditioning'],
    ];
    const trainerBios = [
      'Certified strength and conditioning specialist with 8+ years of experience in transforming bodies and lives.',
      'Internationally certified yoga instructor specializing in Hatha and Vinyasa yoga for holistic wellness.',
      'Former national-level athlete and CrossFit L2 trainer dedicated to pushing limits and achieving goals.',
    ];

    const createdTrainers: any[] = [];
    for (let i = 0; i < trainers.length; i++) {
      const trainer = trainers[i];
      const { data: existingTrainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('user_id', trainer.id)
        .single();

      if (existingTrainer) {
        createdTrainers.push({ ...trainer, trainerId: existingTrainer.id });
        continue;
      }

      const { data: newTrainer, error: trainerError } = await supabase
        .from('trainers')
        .insert({
          user_id: trainer.id,
          branch_id: branchId,
          specializations: trainerSpecializations[i % 3],
          certifications: ['ACE Certified Personal Trainer', 'CPR/AED Certified', 'First Aid Certified'],
          bio: trainerBios[i % 3],
          hourly_rate: 800 + (i * 200),
          max_clients: 15,
          is_active: true,
        })
        .select()
        .single();

      if (trainerError) {
        console.error(`Trainer creation error for ${trainer.email}:`, trainerError);
      } else {
        createdTrainers.push({ ...trainer, trainerId: newTrainer.id });
        console.log(`Created trainer: ${trainer.full_name}`);
      }
    }

    // ==================== STAFF_BRANCHES FOR TRAINERS ====================
    for (const trainer of createdTrainers) {
      const { error: trainerBranchError } = await supabase
        .from('staff_branches')
        .upsert({
          user_id: trainer.id,
          branch_id: branchId,
          is_primary: true,
        }, { onConflict: 'user_id,branch_id' });

      if (trainerBranchError) {
        console.error(`Trainer staff_branches link error for ${trainer.full_name}:`, trainerBranchError);
      } else {
        console.log(`Linked trainer ${trainer.full_name} to staff_branches`);
      }
    }

    // ==================== MEMBERS ====================
    const memberUsers = createdUsers.filter(u => u.role === 'member');
    const fitnessGoals = ['Weight Loss', 'Muscle Gain', 'General Fitness', 'Endurance', 'Flexibility', 'Strength'];
    const createdMembers: any[] = [];

    for (let i = 0; i < memberUsers.length; i++) {
      const member = memberUsers[i];
      const memberCode = `MEM${String(1000 + i).padStart(4, '0')}`;

      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', member.id)
        .single();

      if (existingMember) {
        createdMembers.push({ ...member, memberId: existingMember.id, memberCode });
        continue;
      }

      const joinedDate = new Date();
      joinedDate.setDate(joinedDate.getDate() - Math.floor(Math.random() * 180));

      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          user_id: member.id,
          branch_id: branchId,
          member_code: memberCode,
          source: ['website', 'walk_in', 'referral', 'social_media'][i % 4],
          status: 'active',
          joined_at: joinedDate.toISOString(),
          fitness_goals: fitnessGoals[i % fitnessGoals.length],
          date_of_birth: member.dob,
          gender: member.gender,
          emergency_contact_name: 'Emergency Contact',
          emergency_contact_phone: '9876500000',
        })
        .select()
        .single();

      if (memberError) {
        console.error(`Member creation error for ${member.email}:`, memberError);
      } else {
        createdMembers.push({ ...member, memberId: newMember.id, memberCode });
        console.log(`Created member: ${member.full_name} (${memberCode})`);
      }
    }

    // ==================== EMPLOYEES ====================
    const employees = createdUsers.filter(u => ['manager', 'staff'].includes(u.role));
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const empCode = `EMP${String(100 + i).padStart(3, '0')}`;

      const { error: empError } = await supabase
        .from('employees')
        .upsert({
          user_id: emp.id,
          branch_id: branchId,
          employee_code: empCode,
          position: emp.role === 'manager' ? 'Branch Manager' : 'Front Desk Staff',
          department: emp.role === 'manager' ? 'Management' : 'Operations',
          hire_date: new Date().toISOString().split('T')[0],
          salary: emp.role === 'manager' ? 50000 : 25000,
          salary_type: 'monthly',
          is_active: true,
        }, { onConflict: 'user_id' });

      if (empError) {
        console.error(`Employee creation error for ${emp.email}:`, empError);
      } else {
        console.log(`Created employee: ${emp.full_name} (${empCode})`);
      }

      const { error: staffBranchError } = await supabase
        .from('staff_branches')
        .upsert({
          user_id: emp.id,
          branch_id: branchId,
          is_primary: true,
        }, { onConflict: 'user_id,branch_id' });

      if (staffBranchError) {
        console.error(`Staff branch link error:`, staffBranchError);
      }

      if (emp.role === 'manager') {
        const { error: branchManagerError } = await supabase
          .from('branch_managers')
          .upsert({
            user_id: emp.id,
            branch_id: branchId,
            is_primary: true,
          }, { onConflict: 'user_id,branch_id' });

        if (branchManagerError) {
          console.error(`Branch manager link error:`, branchManagerError);
        }
      }
    }

    // ==================== ORGANIZATION SETTINGS ====================
    const { error: orgSettingsError } = await supabase
      .from('organization_settings')
      .upsert({
        branch_id: branchId,
        name: 'Incline Fitness',
        logo_url: null,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      }, { onConflict: 'branch_id' });

    if (orgSettingsError) {
      console.error('Organization settings error:', orgSettingsError);
    } else {
      console.log('Created organization settings');
    }

    // ==================== FACILITIES ====================
    const bookableBenefitTypesForFacilities = createdBenefitTypes.filter(bt => 
      ['ICE_BATH', 'SAUNA', 'STEAM_ROOM', 'POOL', 'SPA'].includes(bt.code)
    );

    for (const bt of bookableBenefitTypesForFacilities) {
      const { data: existingFacility } = await supabase
        .from('facilities')
        .select('id')
        .eq('branch_id', branchId)
        .eq('benefit_type_id', bt.id)
        .maybeSingle();

      if (existingFacility) {
        console.log(`Facility ${bt.name} already exists`);
        continue;
      }

      const { error: facilityError } = await supabase
        .from('facilities')
        .insert({
          branch_id: branchId,
          benefit_type_id: bt.id,
          name: bt.name,
          description: bt.description || `${bt.name} facility`,
          capacity: bt.code === 'POOL' ? 20 : 5,
          gender_access: 'all',
          is_active: true,
          available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        });

      if (facilityError) {
        console.error(`Facility creation error for ${bt.name}:`, facilityError);
      } else {
        console.log(`Created facility: ${bt.name}`);
      }
    }

    // ==================== MEMBERSHIP PLANS ====================
    const plans = [
      { name: 'Monthly Basic', price: 1499, duration_days: 30, description: 'Basic gym access with standard equipment', admission_fee: 500 },
      { name: 'Monthly Premium', price: 2499, duration_days: 30, description: 'Full gym access with group classes', admission_fee: 500 },
      { name: 'Quarterly Standard', price: 3999, duration_days: 90, description: '3-month membership with locker access', admission_fee: 0 },
      { name: 'Quarterly Premium', price: 5999, duration_days: 90, description: '3-month premium with all amenities', admission_fee: 0 },
      { name: 'Half-Yearly Premium', price: 9999, duration_days: 180, description: '6-month premium membership', admission_fee: 0 },
      { name: 'Annual Elite', price: 15999, duration_days: 365, description: 'Full year with all amenities and priority booking', admission_fee: 0 },
    ];

    const createdPlans: any[] = [];
    for (const plan of plans) {
      const { data: existingPlan } = await supabase
        .from('membership_plans')
        .select('id')
        .eq('name', plan.name)
        .eq('branch_id', branchId)
        .single();

      if (existingPlan) {
        createdPlans.push({ ...plan, id: existingPlan.id });
        continue;
      }

      const { data: newPlan, error: planError } = await supabase
        .from('membership_plans')
        .insert({
          ...plan,
          branch_id: branchId,
          is_active: true,
          max_freeze_days: Math.floor(plan.duration_days / 10),
        })
        .select()
        .single();

      if (planError) {
        console.error(`Plan creation error for ${plan.name}:`, planError);
      } else {
        createdPlans.push(newPlan);
        console.log(`Created plan: ${plan.name}`);
      }
    }

    // ==================== PLAN BENEFITS ====================
    // Note: plan_benefits uses benefit_type enum, not benefit_type_id
    for (const plan of createdPlans) {
      const planBenefits = [];
      
      // All plans get gym access and group classes
      planBenefits.push({ plan_id: plan.id, benefit_type: 'gym_access', limit_count: null, frequency: 'unlimited' });
      planBenefits.push({ plan_id: plan.id, benefit_type: 'group_classes', limit_count: null, frequency: 'unlimited' });

      // Premium plans get more benefits
      if (plan.name.includes('Premium') || plan.name.includes('Elite')) {
        planBenefits.push({ plan_id: plan.id, benefit_type: 'spa_access', limit_count: 8, frequency: 'monthly' });
        planBenefits.push({ plan_id: plan.id, benefit_type: 'pool_access', limit_count: null, frequency: 'unlimited' });
      }

      // Elite plan gets everything
      if (plan.name.includes('Elite')) {
        planBenefits.push({ plan_id: plan.id, benefit_type: 'locker', limit_count: 1, frequency: 'per_membership' });
        planBenefits.push({ plan_id: plan.id, benefit_type: 'pt_sessions', limit_count: 4, frequency: 'monthly' });
      }

      for (const benefit of planBenefits) {
        const { error } = await supabase
          .from('plan_benefits')
          .upsert(benefit, { onConflict: 'plan_id,benefit_type' });
        
        if (error && !error.message.includes('duplicate')) {
          console.error('Plan benefit error:', error);
        }
      }
    }
    console.log('Created plan benefits');

    // ==================== MEMBERSHIPS FOR MEMBERS ====================
    const elitePlan = createdPlans.find(p => p.name.includes('Elite'));
    const premiumPlan = createdPlans.find(p => p.name.includes('Premium') && p.duration_days === 90);
    const basicPlan = createdPlans.find(p => p.name.includes('Basic'));

    for (let i = 0; i < createdMembers.length; i++) {
      const member = createdMembers[i];
      const plan = i < 2 ? elitePlan : (i < 5 ? premiumPlan : basicPlan);
      if (!plan || !member.memberId) continue;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 30));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.duration_days);

      const { data: existingMembership } = await supabase
        .from('memberships')
        .select('id')
        .eq('member_id', member.memberId)
        .eq('status', 'active')
        .single();

      if (existingMembership) {
        console.log(`Membership already exists for ${member.full_name}`);
        continue;
      }

      const { error: membershipError } = await supabase
        .from('memberships')
        .insert({
          member_id: member.memberId,
          plan_id: plan.id,
          branch_id: branchId,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          status: 'active',
          price_paid: plan.price,
        });

      if (membershipError) {
        console.error(`Membership creation error:`, membershipError);
      } else {
        console.log(`Created membership for ${member.full_name}`);
      }
    }

    // ==================== PT PACKAGES ====================
    const ptPackages = [
      { name: '5 Sessions Starter', total_sessions: 5, validity_days: 30, price: 2500, description: 'Perfect for beginners' },
      { name: '10 Sessions Standard', total_sessions: 10, validity_days: 60, price: 4500, description: 'Most popular choice' },
      { name: '20 Sessions Premium', total_sessions: 20, validity_days: 90, price: 8000, description: 'Serious transformation' },
      { name: '30 Sessions Elite', total_sessions: 30, validity_days: 120, price: 10500, description: 'Complete body overhaul' },
    ];

    for (const pkg of ptPackages) {
      const { data: existingPkg } = await supabase
        .from('pt_packages')
        .select('id')
        .eq('name', pkg.name)
        .eq('branch_id', branchId)
        .single();

      if (existingPkg) continue;

      const { error: pkgError } = await supabase
        .from('pt_packages')
        .insert({
          ...pkg,
          branch_id: branchId,
          is_active: true,
        });

      if (pkgError) {
        console.error(`PT Package creation error:`, pkgError);
      } else {
        console.log(`Created PT package: ${pkg.name}`);
      }
    }

    // ==================== EQUIPMENT ====================
    const equipmentList = [
      { name: 'Treadmill Pro 5000', category: 'Cardio', brand: 'Life Fitness', model: 'Pro 5000', serial_number: 'TM001', location: 'Cardio Zone A' },
      { name: 'Treadmill Pro 5000', category: 'Cardio', brand: 'Life Fitness', model: 'Pro 5000', serial_number: 'TM002', location: 'Cardio Zone A' },
      { name: 'Treadmill Pro 5000', category: 'Cardio', brand: 'Life Fitness', model: 'Pro 5000', serial_number: 'TM003', location: 'Cardio Zone A' },
      { name: 'Spin Bike Elite', category: 'Cardio', brand: 'Schwinn', model: 'IC4', serial_number: 'SB001', location: 'Spin Studio' },
      { name: 'Spin Bike Elite', category: 'Cardio', brand: 'Schwinn', model: 'IC4', serial_number: 'SB002', location: 'Spin Studio' },
      { name: 'Elliptical Trainer', category: 'Cardio', brand: 'Precor', model: 'EFX 885', serial_number: 'ET001', location: 'Cardio Zone B' },
      { name: 'Rowing Machine', category: 'Cardio', brand: 'Concept2', model: 'Model D', serial_number: 'RM001', location: 'Cardio Zone B' },
      { name: 'Power Rack', category: 'Strength', brand: 'Rogue', model: 'R-3', serial_number: 'PR001', location: 'Free Weights Area' },
      { name: 'Power Rack', category: 'Strength', brand: 'Rogue', model: 'R-3', serial_number: 'PR002', location: 'Free Weights Area' },
      { name: 'Smith Machine', category: 'Strength', brand: 'Hammer Strength', model: 'HD Elite', serial_number: 'SM001', location: 'Strength Zone' },
      { name: 'Cable Crossover', category: 'Strength', brand: 'Life Fitness', model: 'Signature', serial_number: 'CC001', location: 'Strength Zone' },
      { name: 'Leg Press', category: 'Strength', brand: 'Cybex', model: 'VR3', serial_number: 'LP001', location: 'Strength Zone' },
      { name: 'Lat Pulldown', category: 'Strength', brand: 'Technogym', model: 'Selection', serial_number: 'LD001', location: 'Strength Zone' },
      { name: 'Dumbbell Set 5-50kg', category: 'Free Weights', brand: 'Eleiko', model: 'Pro', serial_number: 'DB001', location: 'Free Weights Area' },
      { name: 'Olympic Barbell Set', category: 'Free Weights', brand: 'Rogue', model: 'Ohio Bar', serial_number: 'BB001', location: 'Free Weights Area' },
    ];

    const createdEquipment: any[] = [];
    for (const eq of equipmentList) {
      const { data: existingEq } = await supabase
        .from('equipment')
        .select('id')
        .eq('serial_number', eq.serial_number)
        .eq('branch_id', branchId)
        .single();

      if (existingEq) {
        createdEquipment.push({ ...eq, id: existingEq.id });
        continue;
      }

      const purchaseDate = new Date();
      purchaseDate.setMonth(purchaseDate.getMonth() - Math.floor(Math.random() * 24));

      const { data: newEq, error: eqError } = await supabase
        .from('equipment')
        .insert({
          branch_id: branchId,
          name: eq.name,
          category: eq.category,
          brand: eq.brand,
          model: eq.model,
          serial_number: eq.serial_number,
          location: eq.location,
          status: 'operational',
          purchase_date: purchaseDate.toISOString().split('T')[0],
          purchase_price: 50000 + Math.floor(Math.random() * 150000),
          warranty_expiry: new Date(purchaseDate.getTime() + 365 * 24 * 60 * 60 * 1000 * 2).toISOString().split('T')[0],
        })
        .select()
        .single();

      if (eqError) {
        console.error(`Equipment creation error:`, eqError);
      } else {
        createdEquipment.push(newEq);
        console.log(`Created equipment: ${eq.name} (${eq.serial_number})`);
      }
    }

    // ==================== EQUIPMENT MAINTENANCE ====================
    for (let i = 0; i < Math.min(5, createdEquipment.length); i++) {
      const eq = createdEquipment[i];
      if (!eq.id) continue;

      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + Math.floor(Math.random() * 30));

      const { error: maintError } = await supabase
        .from('equipment_maintenance')
        .insert({
          equipment_id: eq.id,
          maintenance_type: ['preventive', 'repair', 'inspection'][i % 3],
          description: ['Quarterly maintenance check', 'Belt replacement', 'Safety inspection', 'Lubrication and calibration', 'Deep cleaning'][i],
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          cost: 500 + Math.floor(Math.random() * 2000),
          notes: 'Regular scheduled maintenance',
        });

      if (maintError) {
        console.error(`Maintenance record error:`, maintError);
      } else {
        console.log(`Created maintenance record for ${eq.name}`);
      }
    }

    // ==================== CLASSES ====================
    const classTypes = [
      { name: 'Morning Yoga', class_type: 'yoga', duration_minutes: 60, capacity: 20, time: '06:00', description: 'Start your day with energizing yoga flow' },
      { name: 'Power HIIT', class_type: 'hiit', duration_minutes: 45, capacity: 15, time: '07:00', description: 'High-intensity interval training for maximum burn' },
      { name: 'Spin Class', class_type: 'spin', duration_minutes: 45, capacity: 20, time: '08:00', description: 'Indoor cycling to pump up your cardio' },
      { name: 'Strength Training 101', class_type: 'strength', duration_minutes: 60, capacity: 12, time: '09:00', description: 'Learn proper form and build strength' },
      { name: 'Zumba Dance', class_type: 'zumba', duration_minutes: 60, capacity: 25, time: '17:00', description: 'Dance your way to fitness' },
      { name: 'Pilates Core', class_type: 'pilates', duration_minutes: 50, capacity: 15, time: '18:00', description: 'Core strengthening and flexibility' },
      { name: 'Boxing Basics', class_type: 'boxing', duration_minutes: 60, capacity: 10, time: '19:00', description: 'Learn boxing fundamentals and get fit' },
      { name: 'CrossFit WOD', class_type: 'crossfit', duration_minutes: 60, capacity: 12, time: '20:00', description: 'Workout of the day - CrossFit style' },
    ];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const classDate = new Date();
      classDate.setDate(classDate.getDate() + dayOffset);

      for (const classType of classTypes) {
        const trainerId = createdTrainers[Math.floor(Math.random() * createdTrainers.length)]?.trainerId;
        const [hours, minutes] = classType.time.split(':').map(Number);
        classDate.setHours(hours, minutes, 0, 0);

        const { error: classError } = await supabase
          .from('classes')
          .insert({
            branch_id: branchId,
            name: classType.name,
            class_type: classType.class_type,
            description: classType.description,
            scheduled_at: classDate.toISOString(),
            duration_minutes: classType.duration_minutes,
            capacity: classType.capacity,
            trainer_id: trainerId,
            is_active: true,
            is_recurring: true,
            recurrence_rule: 'FREQ=WEEKLY',
          });

        if (classError && !classError.message.includes('duplicate')) {
          console.error(`Class creation error:`, classError);
        }
      }
    }
    console.log('Created classes for next 7 days');

    // ==================== PRODUCTS & CATEGORIES ====================
    const categories = [
      { name: 'Supplements', description: 'Protein, vitamins, and nutritional supplements' },
      { name: 'Equipment', description: 'Fitness equipment and accessories' },
      { name: 'Apparel', description: 'Gym clothing and accessories' },
      { name: 'Accessories', description: 'Gym bags, bottles, and other accessories' },
      { name: 'Beverages', description: 'Energy drinks and healthy beverages' },
    ];

    const createdCategories: any[] = [];
    for (const cat of categories) {
      const { data: existingCat } = await supabase
        .from('product_categories')
        .select('id')
        .eq('name', cat.name)
        .single();

      if (existingCat) {
        createdCategories.push({ ...cat, id: existingCat.id });
        continue;
      }

      const { data: newCat, error: catError } = await supabase
        .from('product_categories')
        .insert({ name: cat.name, description: cat.description, is_active: true })
        .select()
        .single();

      if (catError) {
        console.error(`Category creation error:`, catError);
      } else {
        createdCategories.push(newCat);
        console.log(`Created category: ${cat.name}`);
      }
    }

    const products = [
      { name: 'Whey Protein 2kg - Chocolate', price: 2499, sku: 'SUP001', category: 'Supplements', stock: 50 },
      { name: 'Whey Protein 2kg - Vanilla', price: 2499, sku: 'SUP002', category: 'Supplements', stock: 40 },
      { name: 'BCAA Powder 300g', price: 999, sku: 'SUP003', category: 'Supplements', stock: 30 },
      { name: 'Pre-Workout 250g', price: 1299, sku: 'SUP004', category: 'Supplements', stock: 25 },
      { name: 'Creatine Monohydrate 300g', price: 799, sku: 'SUP005', category: 'Supplements', stock: 40 },
      { name: 'Multivitamin 60 tabs', price: 599, sku: 'SUP006', category: 'Supplements', stock: 60 },
      { name: 'Resistance Bands Set', price: 599, sku: 'EQP001', category: 'Equipment', stock: 20 },
      { name: 'Yoga Mat Premium', price: 899, sku: 'EQP002', category: 'Equipment', stock: 15 },
      { name: 'Foam Roller', price: 699, sku: 'EQP003', category: 'Equipment', stock: 25 },
      { name: 'Jump Rope Pro', price: 399, sku: 'EQP004', category: 'Equipment', stock: 30 },
      { name: 'Gym Gloves Pro', price: 499, sku: 'ACC001', category: 'Accessories', stock: 50 },
      { name: 'Shaker Bottle 700ml', price: 299, sku: 'ACC002', category: 'Accessories', stock: 100 },
      { name: 'Gym Bag Large', price: 1499, sku: 'ACC003', category: 'Accessories', stock: 25 },
      { name: 'Microfiber Gym Towel', price: 399, sku: 'ACC004', category: 'Accessories', stock: 75 },
      { name: 'Wrist Wraps', price: 349, sku: 'ACC005', category: 'Accessories', stock: 40 },
      { name: "Men's Training T-Shirt", price: 699, sku: 'APP001', category: 'Apparel', stock: 30 },
      { name: "Women's Sports Bra", price: 899, sku: 'APP002', category: 'Apparel', stock: 25 },
      { name: 'Compression Shorts', price: 799, sku: 'APP003', category: 'Apparel', stock: 20 },
      { name: 'Training Hoodie', price: 1299, sku: 'APP004', category: 'Apparel', stock: 15 },
      { name: 'Energy Drink 500ml', price: 99, sku: 'BEV001', category: 'Beverages', stock: 200 },
      { name: 'Protein Shake RTD', price: 149, sku: 'BEV002', category: 'Beverages', stock: 150 },
    ];

    for (const product of products) {
      const category = createdCategories.find(c => c.name === product.category);
      if (!category) continue;

      const { data: existingProd } = await supabase
        .from('products')
        .select('id')
        .eq('sku', product.sku)
        .single();

      if (existingProd) continue;

      const { error: prodError } = await supabase
        .from('products')
        .insert({
          name: product.name,
          sku: product.sku,
          price: product.price,
          category_id: category.id,
          branch_id: branchId,
          is_active: true,
        });

      if (prodError) {
        console.error(`Product creation error:`, prodError);
      } else {
        console.log(`Created product: ${product.name}`);
      }
    }

    // ==================== LEADS ====================
    const leads = [
      { full_name: 'Ravi Kumar', phone: '9988776655', email: 'ravi.kumar@email.com', status: 'new', source: 'walk_in' },
      { full_name: 'Sunita Sharma', phone: '9988776644', email: 'sunita.sharma@email.com', status: 'contacted', source: 'website' },
      { full_name: 'Deepak Mehta', phone: '9988776633', email: 'deepak.mehta@email.com', status: 'qualified', source: 'referral' },
      { full_name: 'Anita Gupta', phone: '9988776622', email: 'anita.gupta@email.com', status: 'negotiation', source: 'social_media' },
      { full_name: 'Vijay Singh', phone: '9988776611', email: 'vijay.singh@email.com', status: 'contacted', source: 'phone' },
    ];

    for (const lead of leads) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', lead.phone)
        .single();

      if (existingLead) continue;

      const { error: leadError } = await supabase
        .from('leads')
        .insert({
          ...lead,
          branch_id: branchId,
          notes: `Interested in gym membership. Source: ${lead.source}`,
        });

      if (leadError) {
        console.error(`Lead creation error:`, leadError);
      } else {
        console.log(`Created lead: ${lead.full_name}`);
      }
    }

    // ==================== DIET TEMPLATES ====================
    const dietTemplates = [
      {
        name: 'Weight Loss Plan',
        diet_type: 'calorie_deficit',
        calories_target: 1800,
        description: 'Balanced calorie deficit plan for sustainable weight loss',
        meal_plan: {
          breakfast: ['Oatmeal with berries (300 cal)', 'Protein shake with banana (250 cal)', 'Boiled eggs with toast (350 cal)'],
          lunch: ['Grilled chicken salad (400 cal)', 'Brown rice with vegetables (450 cal)', 'Quinoa bowl with tofu (420 cal)'],
          dinner: ['Grilled fish with veggies (350 cal)', 'Lentil soup with bread (380 cal)', 'Chicken stir-fry (400 cal)'],
          snacks: ['Greek yogurt (100 cal)', 'Almonds 10pcs (70 cal)', 'Apple (80 cal)'],
        },
      },
      {
        name: 'Muscle Gain Plan',
        diet_type: 'high_protein',
        calories_target: 3000,
        description: 'High protein plan for muscle building and strength gains',
        meal_plan: {
          breakfast: ['Eggs with avocado toast (500 cal)', 'Protein pancakes (550 cal)', 'Omelette with cheese (480 cal)'],
          lunch: ['Chicken breast with pasta (650 cal)', 'Beef stir-fry with rice (700 cal)', 'Salmon with sweet potato (620 cal)'],
          dinner: ['Steak with mashed potato (700 cal)', 'Grilled chicken with quinoa (600 cal)', 'Fish curry with rice (650 cal)'],
          snacks: ['Protein bar (200 cal)', 'Cottage cheese (150 cal)', 'Banana with peanut butter (250 cal)'],
        },
      },
      {
        name: 'Maintenance Plan',
        diet_type: 'balanced',
        calories_target: 2200,
        description: 'Balanced nutrition for maintaining current physique',
        meal_plan: {
          breakfast: ['Whole grain cereal with milk (350 cal)', 'Smoothie bowl (400 cal)', 'Eggs benedict (450 cal)'],
          lunch: ['Turkey sandwich (450 cal)', 'Soup and salad combo (400 cal)', 'Wrap with grilled veggies (420 cal)'],
          dinner: ['Grilled chicken with sides (500 cal)', 'Pasta with meat sauce (550 cal)', 'Rice bowl with curry (480 cal)'],
          snacks: ['Mixed fruits (120 cal)', 'Trail mix (180 cal)', 'Yogurt parfait (200 cal)'],
        },
      },
    ];

    for (const template of dietTemplates) {
      const { data: existing } = await supabase
        .from('diet_templates')
        .select('id')
        .eq('name', template.name)
        .single();

      if (existing) continue;

      const { error } = await supabase
        .from('diet_templates')
        .insert({
          ...template,
          branch_id: branchId,
          is_active: true,
        });

      if (error) {
        console.error(`Diet template creation error:`, error);
      } else {
        console.log(`Created diet template: ${template.name}`);
      }
    }

    // ==================== LOCKERS ====================
    for (let i = 1; i <= 20; i++) {
      const lockerNumber = `L${String(i).padStart(3, '0')}`;
      const size = i <= 5 ? 'large' : (i <= 12 ? 'medium' : 'small');
      const monthlyFee = size === 'large' ? 500 : (size === 'medium' ? 300 : 200);

      const { data: existingLocker } = await supabase
        .from('lockers')
        .select('id')
        .eq('locker_number', lockerNumber)
        .eq('branch_id', branchId)
        .single();

      if (existingLocker) continue;

      const { error: lockerError } = await supabase
        .from('lockers')
        .insert({
          branch_id: branchId,
          locker_number: lockerNumber,
          size: size,
          status: i <= 5 ? 'assigned' : 'available',
          monthly_fee: monthlyFee,
        });

      if (lockerError) {
        console.error(`Locker creation error:`, lockerError);
      }
    }
    console.log('Created 20 lockers');

    // ==================== MEMBER ATTENDANCE (Past 7 days) ====================
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const attendanceDate = new Date();
      attendanceDate.setDate(attendanceDate.getDate() - dayOffset);

      const membersToCheckIn = createdMembers.slice(0, Math.floor(Math.random() * 5) + 3);

      for (const member of membersToCheckIn) {
        if (!member.memberId) continue;

        const checkInTime = new Date(attendanceDate);
        checkInTime.setHours(6 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);

        const checkOutTime = new Date(checkInTime);
        checkOutTime.setHours(checkOutTime.getHours() + 1 + Math.floor(Math.random() * 2));

        // Skip if today and we want some currently checked in
        const isToday = dayOffset === 0;
        const shouldCheckOut = !isToday || Math.random() > 0.3;

        const { error: attendanceError } = await supabase
          .from('member_attendance')
          .insert({
            member_id: member.memberId,
            branch_id: branchId,
            check_in: checkInTime.toISOString(),
            check_out: shouldCheckOut ? checkOutTime.toISOString() : null,
            check_in_method: ['manual', 'qr_code', 'card'][Math.floor(Math.random() * 3)],
          });

        if (attendanceError && !attendanceError.message.includes('duplicate')) {
          console.error(`Attendance error:`, attendanceError);
        }
      }
    }
    console.log('Created attendance records for past 7 days');

    // ==================== ANNOUNCEMENTS ====================
    const announcements = [
      {
        title: 'New Year Fitness Challenge',
        content: 'Join our 30-day fitness challenge starting January 15th! Complete daily workouts and win exciting prizes. Register at the front desk.',
        target_audience: 'all',
        priority: 1,
      },
      {
        title: 'Updated Gym Hours',
        content: 'Starting next week, we will be open from 5 AM to 11 PM on weekdays. Weekend hours remain unchanged (6 AM - 10 PM).',
        target_audience: 'all',
        priority: 2,
      },
    ];

    for (const announcement of announcements) {
      const publishAt = new Date();
      const expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + 30);

      const { error } = await supabase
        .from('announcements')
        .insert({
          ...announcement,
          branch_id: branchId,
          is_active: true,
          publish_at: publishAt.toISOString(),
          expire_at: expireAt.toISOString(),
        });

      if (error && !error.message.includes('duplicate')) {
        console.error(`Announcement error:`, error);
      } else {
        console.log(`Created announcement: ${announcement.title}`);
      }
    }

    // ==================== TASKS ====================
    const tasks = [
      { title: 'Equipment Safety Inspection', description: 'Perform weekly safety check on all cardio equipment', status: 'pending', priority: 'high' },
      { title: 'Follow up with Tour Leads', description: 'Call leads who scheduled tours this week', status: 'in_progress', priority: 'medium' },
      { title: 'Inventory Restock', description: 'Order protein supplements - stock running low', status: 'pending', priority: 'high' },
      { title: 'Update Class Schedule', description: 'Add new Saturday morning classes to the system', status: 'completed', priority: 'low' },
      { title: 'Member Feedback Review', description: 'Review and respond to feedback from last week', status: 'pending', priority: 'medium' },
    ];

    for (const task of tasks) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 7));

      const { error } = await supabase
        .from('tasks')
        .insert({
          ...task,
          branch_id: branchId,
          due_date: dueDate.toISOString().split('T')[0],
        });

      if (error && !error.message.includes('duplicate')) {
        console.error(`Task error:`, error);
      } else {
        console.log(`Created task: ${task.title}`);
      }
    }

    console.log('==========================================');
    console.log('COMPREHENSIVE SEED DATA CREATION COMPLETED!');
    console.log('==========================================');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Comprehensive test data seeded successfully',
        data: {
          branch: branchId,
          summary: {
            users: createdUsers.length,
            trainers: createdTrainers.length,
            members: createdMembers.length,
            employees: employees.length,
            benefitTypes: createdBenefitTypes.length,
            membershipPlans: createdPlans.length,
            ptPackages: ptPackages.length,
            equipment: createdEquipment.length,
            products: products.length,
            categories: createdCategories.length,
            classes: classTypes.length * 7,
            leads: leads.length,
            dietTemplates: dietTemplates.length,
            lockers: 20,
            announcements: announcements.length,
            tasks: tasks.length,
          },
          credentials: {
            password: 'Test@123',
            users: testUsers.map(u => ({ 
              email: u.email, 
              role: u.role, 
              name: u.full_name 
            })),
          },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Seed error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
