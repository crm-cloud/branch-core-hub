import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useMemberData() {
  const { user } = useAuth();

  // Get linked member record for current user
  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ['my-member', user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Simplified query - fetch trainer profile separately to avoid nested relationship issues
      const { data, error } = await supabase
        .from('members')
        .select(`
          *,
          branch:branches(id, name, code),
          assigned_trainer:trainers!assigned_trainer_id(id, user_id)
        `)
        .eq('user_id', user!.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching member:', error);
        return null;
      }
      
      if (!data) return null;
      
      // If there's an assigned trainer, fetch their profile separately
      if (data.assigned_trainer?.user_id) {
        const { data: trainerProfile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', data.assigned_trainer.user_id)
          .maybeSingle();
        
        (data as any).assigned_trainer.profile = trainerProfile;
      }
      
      return data;
    },
  });

  // Get active membership
  const { data: activeMembership, isLoading: membershipLoading } = useQuery({
    queryKey: ['my-membership', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select(`
          *,
          plan:membership_plans(id, name, duration_days, price, max_freeze_days)
        `)
        .eq('member_id', member!.id)
        .eq('status', 'active')
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Get PT packages
  const { data: ptPackages = [] } = useQuery({
    queryKey: ['my-pt-packages', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_pt_packages')
        .select(`
          *,
          package:pt_packages(name, total_sessions),
          trainer:trainers(id, user_id, profiles:user_id(full_name))
        `)
        .eq('member_id', member!.id)
        .in('status', ['active', 'expired']);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get recent attendance
  const { data: recentAttendance = [] } = useQuery({
    queryKey: ['my-attendance', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_attendance')
        .select('*')
        .eq('member_id', member!.id)
        .order('check_in', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get pending invoices
  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ['my-pending-invoices', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('member_id', member!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get upcoming classes
  const { data: upcomingClasses = [] } = useQuery({
    queryKey: ['my-upcoming-classes', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_bookings')
        .select(`
          *,
          class:classes(id, name, scheduled_at, duration_minutes, trainer:trainers(user_id, profiles:user_id(full_name)))
        `)
        .eq('member_id', member!.id)
        .eq('status', 'booked')
        .gte('class.scheduled_at', new Date().toISOString())
        .order('class(scheduled_at)', { ascending: true })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get measurements
  const { data: measurements = [] } = useQuery({
    queryKey: ['my-measurements', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_measurements')
        .select('*')
        .eq('member_id', member!.id)
        .order('recorded_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate days remaining
  const daysRemaining = activeMembership
    ? Math.max(0, Math.ceil((new Date(activeMembership.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    member,
    activeMembership,
    ptPackages,
    recentAttendance,
    pendingInvoices,
    upcomingClasses,
    measurements,
    daysRemaining,
    isLoading: memberLoading || membershipLoading,
  };
}

export function useTrainerData() {
  const { user } = useAuth();

  // Get linked trainer record for current user
  const { data: trainer, isLoading: trainerLoading } = useQuery({
    queryKey: ['my-trainer', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainers')
        .select(`
          *,
          branch:branches(id, name, code)
        `)
        .eq('user_id', user!.id)
        .single();
      
      if (error) {
        console.error('Error fetching trainer:', error);
        return null;
      }
      return data;
    },
  });

  // Get assigned clients
  const { data: clients = [] } = useQuery({
    queryKey: ['my-pt-clients', trainer?.id],
    enabled: !!trainer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_pt_packages')
        .select(`
          *,
          member:members!member_pt_packages_member_id_fkey(id, member_code, user_id),
          package:pt_packages(name)
        `)
        .eq('trainer_id', trainer!.id)
        .eq('status', 'active');
      
      if (error) throw error;
      
      // Fetch profile data separately for each member
      const clientsWithProfiles = await Promise.all(
        (data || []).map(async (client: any) => {
          if (client.member?.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, avatar_url, phone')
              .eq('id', client.member.user_id)
              .single();
            
            return {
              ...client,
              member: {
                ...client.member,
                profile: profileData
              }
            };
          }
          return client;
        })
      );
      
      return clientsWithProfiles;
    },
  });

  // Get today's sessions
  const { data: todaySessions = [] } = useQuery({
    queryKey: ['my-today-sessions', trainer?.id],
    enabled: !!trainer,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('pt_sessions')
        .select(`
          *,
          member:members(id, member_code, user_id, profiles:user_id(full_name))
        `)
        .eq('trainer_id', trainer!.id)
        .gte('scheduled_at', today)
        .lt('scheduled_at', tomorrow)
        .order('scheduled_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get my classes
  const { data: myClasses = [] } = useQuery({
    queryKey: ['my-trainer-classes', trainer?.id],
    enabled: !!trainer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('trainer_id', trainer!.id)
        .eq('is_active', true)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });

  return {
    trainer,
    clients,
    todaySessions,
    myClasses,
    isLoading: trainerLoading,
  };
}
