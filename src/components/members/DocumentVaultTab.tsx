import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { FileText, Upload, Download, Trash2, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { downloadMemberDocument, openMemberDocument } from '@/lib/documents/memberDocumentUrls';

interface DocumentVaultTabProps {
  memberId: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  registration_form: 'Registration Form',
  contract: 'Signed Contract',
  id_proof: 'ID Proof',
  medical: 'Medical Certificate',
  other: 'Other',
};

export function DocumentVaultTab({ memberId }: DocumentVaultTabProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('contract');

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['member-documents', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_documents')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${memberId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase.from('member_documents').insert({
        member_id: memberId,
        document_type: docType,
        file_url: '',
        storage_path: filePath,
        file_name: file.name,
        uploaded_by: user?.id,
      });
      if (insertError) throw insertError;

      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['member-documents', memberId] });
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from('member_documents').delete().eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['member-documents', memberId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <TabsContent value="documents" className="space-y-4 mt-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Documents
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload section */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-upload" className="cursor-pointer">
                <Button size="sm" variant="outline" className="gap-1.5" asChild disabled={uploading}>
                  <span>
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? 'Uploading...' : 'Upload'}
                  </span>
                </Button>
              </Label>
              <Input id="doc-upload" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
            </div>
          </div>

          {/* Document list */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(doc.created_at), 'dd MMM yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                      try {
                        await openMemberDocument(doc);
                      } catch (err: any) {
                        toast.error(err?.message || 'Unable to open document');
                      }
                    }}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                      try {
                        await downloadMemberDocument(doc);
                      } catch (err: any) {
                        toast.error(err?.message || 'Unable to download document');
                      }
                    }}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(doc.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
