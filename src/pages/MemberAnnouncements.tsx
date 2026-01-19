import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, AlertCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemberData } from '@/hooks/useMemberData';
import { format } from 'date-fns';

export default function MemberAnnouncements() {
  const { member, isLoading: memberLoading } = useMemberData();

  // Fetch active announcements for members
  const { data: announcements = [], isLoading: announcementsLoading } = useQuery({
    queryKey: ['member-announcements', member?.branch_id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .or(`branch_id.eq.${member!.branch_id},branch_id.is.null`)
        .or('target_audience.eq.all,target_audience.eq.members,target_audience.is.null')
        .lte('publish_at', new Date().toISOString())
        .or(`expire_at.gt.${new Date().toISOString()},expire_at.is.null`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching announcements:', error);
        return [];
      }
      return data || [];
    },
  });

  const isLoading = memberLoading || announcementsLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  if (!member) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertCircle className="h-12 w-12 text-warning" />
          <h2 className="text-xl font-semibold">No Member Profile Found</h2>
          <p className="text-muted-foreground">Your account is not linked to a member profile.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-8 w-8 text-accent" />
            Announcements
          </h1>
          <p className="text-muted-foreground">
            Stay updated with the latest news from your gym
          </p>
        </div>

        {announcements.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Megaphone className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Announcements</h3>
              <p className="text-muted-foreground">
                There are no announcements at this time. Check back later!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement: any) => (
              <Card key={announcement.id} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <Megaphone className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{announcement.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(announcement.created_at), 'EEEE, dd MMM yyyy • HH:mm')}
                        </p>
                      </div>
                    </div>
                    {announcement.priority > 0 && (
                      <Badge variant="destructive">Important</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/80 whitespace-pre-wrap">{announcement.content}</p>
                  {announcement.expire_at && (
                    <p className="text-xs text-muted-foreground mt-4">
                      Valid until: {format(new Date(announcement.expire_at), 'dd MMM yyyy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
