import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  User, Users, Phone, Mail, Calendar, MapPin, Building2, 
  CreditCard, Dumbbell, Clock, Gift, AlertCircle,
  CheckCircle, XCircle, Pause, History, Snowflake, 
  Play, UserCog, IndianRupee, Ruler, IdCard, UserMinus, UserCheck,
  Award, Copy, Share2, MessageCircle, Edit
} from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format } from 'date-fns';
import { toast } from 'sonner';
import { FreezeMembershipDrawer } from './FreezeMembershipDrawer';
import { UnfreezeMembershipDrawer } from './UnfreezeMembershipDrawer';
import { AssignTrainerDrawer } from './AssignTrainerDrawer';
import { RecordMeasurementDrawer } from './RecordMeasurementDrawer';
import { CancelMembershipDrawer } from './CancelMembershipDrawer';
import { MeasurementProgressView } from './MeasurementProgressView';
import { EditProfileDrawer } from './EditProfileDrawer';
import { fetchMemberRewards, claimReward, fetchMemberReferrals } from '@/services/referralService';

interface MemberProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: any;
  onPurchaseMembership: () => void;
  onPurchasePT: () => void;
}

export function MemberProfileDrawer({ 
  open, 
  onOpenChange, 
  member,
  onPurchaseMembership,
  onPurchasePT
}: MemberProfileDrawerProps) {
  const queryClient = useQueryClient();
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [unfreezeOpen, setUnfreezeOpen] = useState(false);
  const [assignTrainerOpen, setAssignTrainerOpen] = useState(false);
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const toggleMemberStatus = async () => {
    if (!member?.id) return;
    setIsTogglingStatus(true);
    try {
      const newStatus = member.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('members')
        .update({ status: newStatus })
        .eq('id', member.id);
      
      if (error) throw error;
      toast.success(newStatus === 'active' ? 'Member activated' : 'Member deactivated');
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member-details', member.id] });
    } catch (error) {
      toast.error('Failed to update member status');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Fetch full member details with all relations
  const { data: memberDetails } = useQuery({
    queryKey: ['member-details', member?.id],
    queryFn: async () => {
      if (!member?.id) return null;
      
      const { data, error } = await supabase
        .from('members')
        .select(`
          *,
          profiles:user_id(
            full_name, email, phone, avatar_url, gender, date_of_birth,
            address, city, state, emergency_contact_name, emergency_contact_phone
          ),
          branch:branch_id(name, code),
          created_by_profile:created_by(full_name, email),
          memberships(
            *,
            membership_plans(name, duration_days, price)
          ),
          member_pt_packages(
            *,
            pt_packages(name, total_sessions),
            trainers(user_id)
          ),
          referrer:referred_by(member_code)
        `)
        .eq('id', member.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!member?.id && open,
  });

  // Fetch payment history
  const { data: payments = [] } = useQuery({
    queryKey: ['member-payments', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          invoices(invoice_number)
        `)
        .eq('member_id', member.id)
        .order('payment_date', { ascending: false })
        .limit(10);
      
      if (error) throw error;

      // Fetch receiver names from profiles separately (received_by references auth.users, not profiles)
      const receiverIds = [...new Set(data?.filter(p => p.received_by).map(p => p.received_by) || [])];
      let receiverMap: Record<string, string> = {};
      if (receiverIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', receiverIds);
        if (profiles) {
          receiverMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
        }
      }

      return (data || []).map(p => ({
        ...p,
        received_by_name: p.received_by ? receiverMap[p.received_by] || null : null,
      }));
    },
    enabled: !!member?.id && open,
  });

  // Fetch attendance history
  const { data: attendance = [] } = useQuery({
    queryKey: ['member-attendance', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      
      const { data, error } = await supabase
        .from('member_attendance')
        .select('*')
        .eq('member_id', member.id)
        .order('check_in', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!member?.id && open,
  });

  // Fetch rewards
  const { data: rewards = [] } = useQuery({
    queryKey: ['member-rewards', member?.id],
    queryFn: () => fetchMemberRewards(member.id),
    enabled: !!member?.id && open,
  });

  // Fetch referrals
  const { data: referrals = [] } = useQuery({
    queryKey: ['member-referrals', member?.id],
    queryFn: () => fetchMemberReferrals(member.id),
    enabled: !!member?.id && open,
  });

  // Claim reward mutation
  const claimRewardMutation = useMutation({
    mutationFn: (rewardId: string) => claimReward(rewardId, member.id),
    onSuccess: () => {
      toast.success('Reward claimed successfully!');
      queryClient.invalidateQueries({ queryKey: ['member-rewards', member?.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to claim reward');
    },
  });

  const copyReferralCode = () => {
    const code = member.member_code;
    navigator.clipboard.writeText(code);
    toast.success('Referral code copied!');
  };

  const shareViaWhatsApp = () => {
    const code = member.member_code;
    const message = `Join ${theme?.gymName || 'our gym'} with my referral code: ${code} and get exclusive rewards!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shareViaEmail = () => {
    const code = member.member_code;
    const subject = `Join me at ${theme?.gymName || 'our gym'}!`;
    const body = `Hey!\n\nI'd love for you to join my gym. Use my referral code: ${code} when signing up to get exclusive rewards!\n\nSee you there!`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const [theme, setTheme] = useState<any>(null);
  
  // Load theme for gym name
  useState(() => {
    import('@/services/cmsService').then(({ cmsService }) => {
      setTheme(cmsService.getTheme());
    });
  });

  if (!member) return null;

  const profile = memberDetails?.profiles || member.profiles;
  const activeMembership = memberDetails?.memberships?.find((m: any) => m.status === 'active');
  const activePTPackage = memberDetails?.member_pt_packages?.find((p: any) => p.status === 'active');
  
  const daysLeft = activeMembership 
    ? differenceInDays(new Date(activeMembership.end_date), new Date())
    : 0;

  const getDaysLeftColor = (days: number) => {
    if (days <= 0) return 'text-destructive';
    if (days <= 7) return 'text-destructive';
    if (days <= 30) return 'text-warning';
    return 'text-success';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'expired': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'frozen': return <Pause className="h-4 w-4 text-warning" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getMemberStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-success/10 text-success',
      inactive: 'bg-muted text-muted-foreground',
      suspended: 'bg-destructive/10 text-destructive',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Member Profile
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Profile Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="text-lg">
                {profile?.full_name?.charAt(0) || 'M'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{profile?.full_name || 'N/A'}</h2>
                <Badge className={getMemberStatusColor(member.status)}>{member.status}</Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                  onClick={() => setEditProfileOpen(true)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground font-mono">{member.member_code}</p>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                {profile?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {profile.email}
                  </span>
                )}
                {profile?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {profile.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                {activeMembership ? (
                  daysLeft > 0 ? (
                    <div className={`text-2xl font-bold ${getDaysLeftColor(daysLeft)}`}>{daysLeft}</div>
                  ) : (
                    <div className="text-lg font-bold text-destructive">EXPIRED</div>
                  )
                ) : (
                  <div className="text-sm font-bold text-muted-foreground">No Plan</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {activeMembership && daysLeft <= 0 ? 'Plan Status' : 'Days Left'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-primary">
                  {activePTPackage?.sessions_remaining || 0}
                </div>
                <p className="text-xs text-muted-foreground">PT Sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold">
                  {attendance.length}
                </div>
                <p className="text-xs text-muted-foreground">Recent Visits</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions - Row 1 */}
          <div className="flex gap-2">
            <Button 
              variant={activeMembership && daysLeft > 0 ? 'outline' : 'default'} 
              className="flex-1"
              onClick={() => { onOpenChange(false); onPurchaseMembership(); }}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {activeMembership && daysLeft > 0 ? 'Upgrade Plan' : (activeMembership && daysLeft <= 0 ? 'Renew Plan' : 'Add Plan')}
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => { onOpenChange(false); onPurchasePT(); }}
              disabled={!activeMembership}
            >
              <Dumbbell className="h-4 w-4 mr-2" />
              Buy PT
            </Button>
          </div>

          {/* Quick Actions - Row 2 */}
          <div className="grid grid-cols-4 gap-2">
            {activeMembership?.status === 'active' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setFreezeOpen(true)}>
                    <Snowflake className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Freeze Membership</TooltipContent>
              </Tooltip>
            )}
            {activeMembership?.status === 'frozen' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setUnfreezeOpen(true)}>
                    <Play className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unfreeze Membership</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setAssignTrainerOpen(true)}>
                  <UserCog className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Assign Trainer</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setMeasurementOpen(true)}>
                  <Ruler className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Record Measurement</TooltipContent>
            </Tooltip>
            {activeMembership && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelOpen(true)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancel Membership</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={member.status === 'active' ? 'text-destructive' : 'text-success'}
                  onClick={toggleMemberStatus}
                  disabled={isTogglingStatus}
                >
                  {member.status === 'active' ? <UserMinus className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {member.status === 'active' ? 'Deactivate Member' : 'Activate Member'}
              </TooltipContent>
            </Tooltip>
          </div>

          <Separator />

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="membership">Plan</TabsTrigger>
              <TabsTrigger value="measurements">Body</TabsTrigger>
              <TabsTrigger value="payments">Pay</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Personal Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground">Gender:</span>
                      <span className="ml-2 capitalize">{profile?.gender || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DOB:</span>
                      <span className="ml-2">
                        {profile?.date_of_birth ? format(new Date(profile.date_of_birth), 'dd MMM yyyy') : 'Not specified'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Address:</span>
                      <span className="ml-2">{profile?.address || 'Not provided'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Branch & Source Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Registration Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{memberDetails?.branch?.name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Joined: {format(new Date(member.joined_at), 'dd MMM yyyy')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Source:</span>
                      <span className="ml-2 capitalize">{member.source || 'Walk-in'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created by:</span>
                      <span className="ml-2">{(memberDetails?.created_by_profile as any)?.full_name || 'System'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Referral Info */}
              {memberDetails?.referrer && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Gift className="h-4 w-4" />
                      <span className="font-medium">Referred by:</span>
                      <span>{(memberDetails?.referrer as any)?.member_code || 'Unknown'}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Emergency Contact */}
              {(profile?.emergency_contact_name || profile?.emergency_contact_phone) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Emergency Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p>{profile.emergency_contact_name}</p>
                    <p className="text-muted-foreground">{profile.emergency_contact_phone}</p>
                  </CardContent>
                </Card>
              )}

              {/* Health & Goals */}
              {(member.fitness_goals || member.health_conditions) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Fitness Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {member.fitness_goals && (
                      <div>
                        <span className="text-muted-foreground">Goals:</span>
                        <span className="ml-2">{member.fitness_goals}</span>
                      </div>
                    )}
                    {member.health_conditions && (
                      <div>
                        <span className="text-muted-foreground">Health Conditions:</span>
                        <span className="ml-2 text-destructive">{member.health_conditions}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="membership" className="space-y-4 mt-4">
              {/* Active Membership */}
              {activeMembership ? (
                <Card className="border-success/30 bg-success/5">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {getStatusIcon('active')}
                        Active Membership
                      </CardTitle>
                      <Badge className={getDaysLeftColor(daysLeft)}>
                        {daysLeft > 0 ? `${daysLeft} days left` : 'Expiring today'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-medium">{activeMembership.membership_plans?.name}</p>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <div>Start: {format(new Date(activeMembership.start_date), 'dd MMM yyyy')}</div>
                      <div>End: {format(new Date(activeMembership.end_date), 'dd MMM yyyy')}</div>
                      <div>Paid: ₹{activeMembership.price_paid}</div>
                      <div>By: N/A</div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="pt-4 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
                    <p className="font-medium">No Active Membership</p>
                    <p className="text-sm text-muted-foreground">Add a membership plan to activate</p>
                  </CardContent>
                </Card>
              )}

              {/* Active PT Package */}
              {activePTPackage && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Dumbbell className="h-4 w-4" />
                      PT Package
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="font-medium">{activePTPackage.pt_packages?.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>Sessions: {activePTPackage.sessions_remaining}/{activePTPackage.sessions_total}</div>
                      <div>Trainer: Assigned</div>
                      <div>Expires: {format(new Date(activePTPackage.expiry_date), 'dd MMM yyyy')}</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Membership History */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Membership History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {memberDetails?.memberships?.length > 0 ? (
                    <div className="space-y-2">
                      {memberDetails.memberships.map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="font-medium text-sm">{m.membership_plans?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(m.start_date), 'dd MMM yy')} - {format(new Date(m.end_date), 'dd MMM yy')}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {m.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No membership history</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4 mt-4">
              {payments.length > 0 ? (
                <div className="space-y-2">
                  {payments.map((payment: any) => (
                    <Card key={payment.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">₹{payment.amount}</p>
                            <p className="text-xs text-muted-foreground">
                              {payment.invoices?.invoice_number || 'No invoice'}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="capitalize">
                              {payment.payment_method?.replace('_', ' ')}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                            </p>
                            {payment.received_by_name && (
                              <p className="text-xs text-muted-foreground">
                                By: {payment.received_by_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-4 text-center text-muted-foreground">
                    No payment history
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="measurements" className="space-y-4 mt-4">
              <MeasurementProgressView memberId={member.id} />
            </TabsContent>

            <TabsContent value="rewards" className="space-y-4 mt-4">
              {/* Referral Code Card */}
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Your Referral Code
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 bg-background rounded-lg px-4 py-3 font-mono text-lg font-bold">
                      {member.member_code}
                    </div>
                    <Button variant="outline" size="icon" onClick={copyReferralCode}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={shareViaWhatsApp}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={shareViaEmail}>
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold text-primary">{referrals.length}</div>
                    <p className="text-xs text-muted-foreground">Total Referrals</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold text-success">
                      {rewards.filter((r: any) => !r.is_claimed).length}
                    </div>
                    <p className="text-xs text-muted-foreground">Unclaimed Rewards</p>
                  </CardContent>
                </Card>
              </div>

              {/* Rewards List */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Your Rewards
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rewards.length > 0 ? (
                    <div className="space-y-2">
                      {rewards.map((reward: any) => (
                        <div key={reward.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <div className="flex items-center gap-2">
                              <Gift className="h-4 w-4 text-primary" />
                              <span className="font-medium capitalize">
                                {reward.reward_type?.replace('_', ' ') || 'Reward'}
                              </span>
                            </div>
                            {reward.reward_value && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Value: ₹{reward.reward_value}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {reward.is_claimed ? (
                              <Badge variant="outline" className="text-muted-foreground">
                                Claimed
                              </Badge>
                            ) : (
                              <Button 
                                size="sm" 
                                onClick={() => claimRewardMutation.mutate(reward.id)}
                                disabled={claimRewardMutation.isPending}
                              >
                                Claim
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No rewards yet</p>
                      <p className="text-xs mt-1">Refer friends to earn rewards!</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Referrals */}
              {referrals.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Recent Referrals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {referrals.slice(0, 5).map((ref: any) => (
                        <div key={ref.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{ref.referred_name || 'Member'}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(ref.created_at), 'dd MMM yyyy')}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize text-xs">
                            {ref.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent Visits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {attendance.length > 0 ? (
                    <div className="space-y-2">
                      {attendance.map((att: any) => (
                        <div key={att.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-success" />
                            <span className="text-sm">
                              {format(new Date(att.check_in), 'dd MMM yyyy, HH:mm')}
                            </span>
                          </div>
                          {att.check_out && (
                            <span className="text-xs text-muted-foreground">
                              Out: {format(new Date(att.check_out), 'HH:mm')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No attendance records</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Drawer Components */}
        {activeMembership && (
          <>
            <FreezeMembershipDrawer
              open={freezeOpen}
              onOpenChange={setFreezeOpen}
              membership={activeMembership}
              memberName={profile?.full_name}
            />
            <UnfreezeMembershipDrawer
              open={unfreezeOpen}
              onOpenChange={setUnfreezeOpen}
              membership={activeMembership}
              memberName={profile?.full_name}
            />
            <CancelMembershipDrawer
              open={cancelOpen}
              onOpenChange={setCancelOpen}
              membership={activeMembership}
              memberName={profile?.full_name}
            />
          </>
        )}
        <AssignTrainerDrawer
          open={assignTrainerOpen}
          onOpenChange={setAssignTrainerOpen}
          memberId={member.id}
          memberName={profile?.full_name}
          branchId={member.branch_id}
        />
        <RecordMeasurementDrawer
          open={measurementOpen}
          onOpenChange={setMeasurementOpen}
          memberId={member.id}
          memberName={profile?.full_name}
        />
        <EditProfileDrawer
          open={editProfileOpen}
          onOpenChange={setEditProfileOpen}
          member={member}
          profile={profile}
        />
      </SheetContent>
    </Sheet>
  );
}