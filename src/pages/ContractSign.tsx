import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileSignature, ShieldCheck } from 'lucide-react';

import { useNoindex } from '@/lib/seo/useNoindex';
function extractTerms(terms: any): string {
  if (!terms) return 'No contract terms available.';
  if (typeof terms === 'string') return terms;
  if (typeof terms === 'object' && typeof terms.conditions === 'string') return terms.conditions;
  return JSON.stringify(terms, null, 2);
}

export default function ContractSignPage() {
  useNoindex('Sign Contract | The Incline Life');
  const { token } = useParams();
  const [signedName, setSignedName] = useState('');
  const [signerContact, setSignerContact] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [consent, setConsent] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-contract-sign', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('contract-signing', {
        body: { action: 'get_contract', token },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });

  const contract = data?.contract;
  const termsText = useMemo(() => extractTerms(contract?.terms), [contract?.terms]);

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Missing signing token');
      const { data, error } = await supabase.functions.invoke('contract-signing', {
        body: {
          action: 'sign_contract',
          token,
          signed_name: signedName.trim(),
          signer_contact: signerContact.trim() || null,
          signature_text: signatureText.trim(),
          consent,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Contract signed successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to sign contract');
    },
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading contract...</div>;
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-xl w-full">
          <CardHeader>
            <CardTitle>Invalid or Expired Link</CardTitle>
            <CardDescription>This contract signing link is invalid, expired, or already used.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Employment Agreement Signature
            </CardTitle>
            <CardDescription>
              Review your contract and add your digital signature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><strong>Employee:</strong> {contract.employee_name}</div>
              <div><strong>Code:</strong> {contract.employee_code}</div>
              <div><strong>Type:</strong> <span className="capitalize">{String(contract.contract_type || '').replace('_', ' ')}</span></div>
              <div><strong>Salary:</strong> Rs. {Number(contract.salary || 0).toLocaleString('en-IN')}</div>
              <div><strong>Start Date:</strong> {contract.start_date}</div>
              <div><strong>Status:</strong> <Badge variant="outline">{contract.signature_status || 'sent'}</Badge></div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h3 className="font-semibold">Contract Terms</h3>
              <div className="rounded-md border bg-background p-4 max-h-[360px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                {termsText}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signed-name">Full Name *</Label>
                <Input id="signed-name" value={signedName} onChange={(e) => setSignedName(e.target.value)} placeholder="Enter your full legal name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signer-contact">Phone or Email (optional)</Label>
                <Input id="signer-contact" value={signerContact} onChange={(e) => setSignerContact(e.target.value)} placeholder="For record and follow-up" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signature-text">Type Signature *</Label>
                <Input id="signature-text" value={signatureText} onChange={(e) => setSignatureText(e.target.value)} placeholder="Type your signature" />
              </div>

              <div className="flex items-start gap-2 rounded-md border p-3 bg-background">
                <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} />
                <Label htmlFor="consent" className="text-sm leading-relaxed">
                  I confirm I have read and agree to this contract, and I consent to using this digital signature as legally binding acceptance.
                </Label>
              </div>

              <Button
                className="w-full"
                disabled={signMutation.isPending || !signedName.trim() || !signatureText.trim() || !consent}
                onClick={() => signMutation.mutate()}
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                {signMutation.isPending ? 'Signing...' : 'Sign Contract'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
