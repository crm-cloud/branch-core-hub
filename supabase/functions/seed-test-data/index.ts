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

    console.log('Starting seed data creation...');

    // Get or create branch
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

    // Test users to create
    const testUsers = [
      { email: 'neha.verma@test.com', full_name: 'Neha Verma', phone: '9876543201', role: 'manager' },
      { email: 'amit.kumar@test.com', full_name: 'Amit Kumar', phone: '9876543202', role: 'staff' },
      { email: 'vikram.singh@test.com', full_name: 'Vikram Singh', phone: '9876543203', role: 'trainer' },
      { email: 'anjali.gupta@test.com', full_name: 'Anjali Gupta', phone: '9876543204', role: 'trainer' },
      { email: 'rahul.sharma@test.com', full_name: 'Rahul Sharma', phone: '9876543205', role: 'member' },
      { email: 'priya.patel@test.com', full_name: 'Priya Patel', phone: '9876543206', role: 'member' },
      { email: 'arjun.reddy@test.com', full_name: 'Arjun Reddy', phone: '9876543207', role: 'member' },
      { email: 'kavita.iyer@test.com', full_name: 'Kavita Iyer', phone: '9876543208', role: 'member' },
    ];

    const createdUsers: any[] = [];

    for (const user of testUsers) {
      // Check if user already exists
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const userExists = existingUser?.users?.find(u => u.email === user.email);

      if (userExists) {
        console.log(`User ${user.email} already exists, skipping...`);
        createdUsers.push({ ...user, id: userExists.id });
        continue;
      }

      // Create auth user
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

      // Update profile (profile is auto-created by trigger, just update phone)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: user.full_name,
          phone: user.phone,
        })
        .eq('id', authUser.user.id);

      if (profileError) {
        console.error(`Profile update error for ${user.email}:`, profileError);
      }

      // Insert user role into user_roles table
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

    // Create trainers (without experience_years - column doesn't exist)
    const trainers = createdUsers.filter(u => u.role === 'trainer');
    for (const trainer of trainers) {
      const { error: trainerError } = await supabase
        .from('trainers')
        .upsert({
          user_id: trainer.id,
          branch_id: branchId,
          specializations: ['Strength Training', 'HIIT', 'Functional Training'],
          certifications: ['ACE Certified', 'CPR Certified'],
          bio: `Experienced personal trainer specializing in strength and conditioning.`,
          hourly_rate: 500 + Math.floor(Math.random() * 500),
          max_clients: 15,
          is_active: true,
        }, { onConflict: 'user_id' });

      if (trainerError) {
        console.error(`Trainer creation error for ${trainer.email}:`, trainerError);
      } else {
        console.log(`Created trainer: ${trainer.full_name}`);
      }
    }

    // Create members
    const members = createdUsers.filter(u => u.role === 'member');
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const memberCode = `MEM${String(1000 + i).padStart(4, '0')}`;
      
      const { error: memberError } = await supabase
        .from('members')
        .upsert({
          user_id: member.id,
          branch_id: branchId,
          member_code: memberCode,
          source: 'website',
          status: 'active',
          joined_at: new Date().toISOString(),
          fitness_goals: ['Weight Loss', 'Muscle Gain', 'General Fitness'][i % 3],
        }, { onConflict: 'user_id' });

      if (memberError) {
        console.error(`Member creation error for ${member.email}:`, memberError);
      } else {
        console.log(`Created member: ${member.full_name} (${memberCode})`);
      }
    }

    // Create employees for manager and staff
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

      // Link staff/manager to branch via staff_branches
      const { error: staffBranchError } = await supabase
        .from('staff_branches')
        .upsert({
          user_id: emp.id,
          branch_id: branchId,
          is_primary: true,
        }, { onConflict: 'user_id,branch_id' });

      if (staffBranchError) {
        console.error(`Staff branch link error for ${emp.email}:`, staffBranchError);
      } else {
        console.log(`Linked ${emp.full_name} to branch`);
      }

      // Make manager a branch manager
      if (emp.role === 'manager') {
        const { error: branchManagerError } = await supabase
          .from('branch_managers')
          .upsert({
            user_id: emp.id,
            branch_id: branchId,
            is_primary: true,
          }, { onConflict: 'user_id,branch_id' });

        if (branchManagerError) {
          console.error(`Branch manager link error for ${emp.email}:`, branchManagerError);
        } else {
          console.log(`Made ${emp.full_name} a branch manager`);
        }
      }
    }

    // Create product categories (without branch_id - column doesn't exist)
    const categories = [
      { name: 'Supplements', description: 'Protein, vitamins, and nutritional supplements' },
      { name: 'Equipment', description: 'Fitness equipment and accessories' },
      { name: 'Apparel', description: 'Gym clothing and accessories' },
      { name: 'Accessories', description: 'Gym bags, bottles, and other accessories' },
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
        .insert({
          name: cat.name,
          description: cat.description,
          is_active: true,
        })
        .select()
        .single();

      if (catError) {
        console.error(`Category creation error:`, catError);
      } else {
        createdCategories.push(newCat);
        console.log(`Created category: ${cat.name}`);
      }
    }

    // Create products
    const products = [
      { name: 'Whey Protein 2kg', price: 2499, sku: 'SUP001', category: 'Supplements', stock: 50 },
      { name: 'BCAA Powder 300g', price: 999, sku: 'SUP002', category: 'Supplements', stock: 30 },
      { name: 'Pre-Workout 250g', price: 1299, sku: 'SUP003', category: 'Supplements', stock: 25 },
      { name: 'Creatine Monohydrate 300g', price: 799, sku: 'SUP004', category: 'Supplements', stock: 40 },
      { name: 'Resistance Bands Set', price: 599, sku: 'EQP001', category: 'Equipment', stock: 20 },
      { name: 'Yoga Mat Premium', price: 899, sku: 'EQP002', category: 'Equipment', stock: 15 },
      { name: 'Adjustable Dumbbells 10kg', price: 2999, sku: 'EQP003', category: 'Equipment', stock: 10 },
      { name: 'Gym Gloves Pro', price: 499, sku: 'ACC001', category: 'Accessories', stock: 50 },
      { name: 'Shaker Bottle 700ml', price: 299, sku: 'ACC002', category: 'Accessories', stock: 100 },
      { name: 'Gym Bag Large', price: 1499, sku: 'ACC003', category: 'Accessories', stock: 25 },
      { name: 'Microfiber Gym Towel', price: 399, sku: 'ACC004', category: 'Accessories', stock: 75 },
      { name: 'Men\'s Training T-Shirt', price: 699, sku: 'APP001', category: 'Apparel', stock: 30 },
      { name: 'Women\'s Sports Bra', price: 899, sku: 'APP002', category: 'Apparel', stock: 25 },
      { name: 'Compression Shorts', price: 799, sku: 'APP003', category: 'Apparel', stock: 20 },
    ];

    for (const product of products) {
      const category = createdCategories.find(c => c.name === product.category);
      if (!category) continue;

      const { data: existingProd } = await supabase
        .from('products')
        .select('id')
        .eq('sku', product.sku)
        .single();

      if (existingProd) {
        console.log(`Product ${product.sku} already exists, skipping...`);
        continue;
      }

      const { error: prodError } = await supabase
        .from('products')
        .insert({
          name: product.name,
          sku: product.sku,
          price: product.price,
          category_id: category.id,
          branch_id: branchId,
          stock_quantity: product.stock,
          is_active: true,
        });

      if (prodError) {
        console.error(`Product creation error for ${product.name}:`, prodError);
      } else {
        console.log(`Created product: ${product.name}`);
      }
    }

    // Create membership plans
    const plans = [
      { name: 'Monthly Basic', price: 1499, duration_days: 30, description: 'Basic gym access' },
      { name: 'Quarterly Standard', price: 3999, duration_days: 90, description: '3-month membership with added benefits' },
      { name: 'Half-Yearly Premium', price: 6999, duration_days: 180, description: '6-month premium membership' },
      { name: 'Annual Elite', price: 11999, duration_days: 365, description: 'Full year with all amenities' },
    ];

    for (const plan of plans) {
      const { data: existingPlan } = await supabase
        .from('membership_plans')
        .select('id')
        .eq('name', plan.name)
        .single();

      if (existingPlan) {
        console.log(`Plan ${plan.name} already exists, skipping...`);
        continue;
      }

      const { error: planError } = await supabase
        .from('membership_plans')
        .insert({
          ...plan,
          branch_id: branchId,
          is_active: true,
          admission_fee: 500,
          max_freeze_days: Math.floor(plan.duration_days / 10),
        });

      if (planError) {
        console.error(`Plan creation error for ${plan.name}:`, planError);
      } else {
        console.log(`Created plan: ${plan.name}`);
      }
    }

    // Create PT packages
    const ptPackages = [
      { name: '5 Sessions Pack', total_sessions: 5, validity_days: 30, price: 2500 },
      { name: '10 Sessions Pack', total_sessions: 10, validity_days: 60, price: 4500 },
      { name: '20 Sessions Pack', total_sessions: 20, validity_days: 90, price: 8000 },
    ];

    for (const pkg of ptPackages) {
      const { data: existingPkg } = await supabase
        .from('pt_packages')
        .select('id')
        .eq('name', pkg.name)
        .single();

      if (existingPkg) {
        console.log(`PT Package ${pkg.name} already exists, skipping...`);
        continue;
      }

      const { error: pkgError } = await supabase
        .from('pt_packages')
        .insert({
          ...pkg,
          branch_id: branchId,
          is_active: true,
        });

      if (pkgError) {
        console.error(`PT Package creation error for ${pkg.name}:`, pkgError);
      } else {
        console.log(`Created PT package: ${pkg.name}`);
      }
    }

    console.log('Seed data creation completed!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test data seeded successfully',
        data: {
          branch: branchId,
          usersCreated: createdUsers.length,
          trainersCreated: trainers.length,
          membersCreated: members.length,
          employeesCreated: employees.length,
          categoriesCreated: createdCategories.length,
          productsSeeded: products.length,
          plansSeeded: plans.length,
          credentials: {
            password: 'Test@123',
            users: testUsers.map(u => ({ email: u.email, role: u.role, name: u.full_name })),
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