import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, LogOut, MapPin } from 'lucide-react';
import { GymLoader } from '@/components/ui/gym-loader';

export default function SelectBranch() {
  const { user, signOut, profile } = useAuth();
  const { branches, setSelectedBranch, isLoading } = useBranchContext();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  // If only one branch or none, redirect immediately
  useEffect(() => {
    if (!isLoading && branches.length <= 1) {
      if (branches.length === 1) {
        setSelectedBranch(branches[0].id);
        sessionStorage.setItem('current_branch_id', branches[0].id);
      }
      navigate('/dashboard', { replace: true });
    }
  }, [branches, isLoading, navigate, setSelectedBranch]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <GymLoader text="Loading branches..." />
      </div>
    );
  }

  const handleSelect = () => {
    if (!selected) return;
    setSelectedBranch(selected);
    sessionStorage.setItem('current_branch_id', selected);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--gradient-hero)' }}
    >
      <Card className="w-full max-w-lg glass animate-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Building2 className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold">Select Branch</CardTitle>
          <CardDescription>
            Hi{profile?.full_name ? `, ${profile.full_name}` : ''}! Choose a branch to manage this session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {branches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => setSelected(branch.id)}
                className={`flex items-center gap-3 w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selected === branch.id
                    ? 'border-accent bg-accent/10 shadow-md'
                    : 'border-border hover:border-accent/50 hover:bg-muted/50'
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  selected === branch.id ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{branch.name}</p>
                  <p className="text-sm text-muted-foreground">{branch.code}</p>
                </div>
              </button>
            ))}
          </div>

          <Button onClick={handleSelect} disabled={!selected} className="w-full">
            Continue to Dashboard
          </Button>
          <Button variant="ghost" onClick={signOut} className="w-full text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
