import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, MessageSquare, Mail, Phone, Copy, Send, CheckCircle, Clock, XCircle, PauseCircle } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATE_TYPES = [
  { value: 'sms', label: 'SMS', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
];

const TEMPLATE_TRIGGERS = [
  { value: 'welcome', label: 'Welcome Message' },
  { value: 'expiry_reminder', label: 'Expiry Reminder' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'payment_due', label: 'Payment Due' },
  { value: 'birthday', label: 'Birthday Wishes' },
  { value: 'class_reminder', label: 'Class Reminder' },
  { value: 'pt_session', label: 'PT Session Reminder' },
  { value: 'custom', label: 'Custom / Broadcast' },
];

const AVAILABLE_VARIABLES = [
  '{{member_name}}',
  '{{member_code}}',
  '{{days_left}}',
  '{{end_date}}',
  '{{plan_name}}',
  '{{amount}}',
  '{{invoice_number}}',
  '{{branch_name}}',
  '{{trainer_name}}',
  '{{class_name}}',
  '{{date}}',
  '{{time}}',
];

const META_CATEGORIES = [
  { value: 'UTILITY', label: 'Utility' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
];

const META_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'en_US', label: 'English (US)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
  { value: 'mr', label: 'Marathi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'bn', label: 'Bengali' },
];

interface Template {
  id: string;
  name: string;
  type: string;
  trigger?: string;
  subject?: string;
  content: string;
  variables?: string[];
  is_active: boolean;
  created_at: string;
  meta_template_name?: string | null;
  meta_template_status?: string | null;
  meta_rejection_reason?: string | null;
}

function metaStatusBadge(status: string | null | undefined) {
  if (!status) return null;
  const map: Record<string, { label: string; icon: any; className: string }> = {
    APPROVED: { label: 'Approved', icon: CheckCircle, className: 'bg-green-100 text-green-700 border-green-200' },
    PENDING: { label: 'Pending', icon: Clock, className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    REJECTED: { label: 'Rejected', icon: XCircle, className: 'bg-red-100 text-red-700 border-red-200' },
    PAUSED: { label: 'Paused', icon: PauseCircle, className: 'bg-gray-100 text-gray-600 border-gray-200' },
    DISABLED: { label: 'Disabled', icon: PauseCircle, className: 'bg-gray-100 text-gray-600 border-gray-200' },
  };
  const cfg = map[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export function TemplateManager() {
  const queryClient = useQueryClient();
  const { branchFilter } = useBranchContext();
  const [showEditor, setShowEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showMetaDialog, setShowMetaDialog] = useState(false);
  const [metaTarget, setMetaTarget] = useState<Template | null>(null);
  const [metaForm, setMetaForm] = useState({
    name: '',
    category: 'UTILITY',
    language: 'en',
    body_text: '',
  });
  const [isSubmittingMeta, setIsSubmittingMeta] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: 'whatsapp',
    trigger: 'custom',
    subject: '',
    content: '',
    is_active: true,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['communication-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('type', { ascending: true });
      if (error) throw error;
      return data as Template[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<Template, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('templates').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template created');
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      closeEditor();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Template>) => {
      const { error } = await supabase.from('templates').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template updated');
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      closeEditor();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
    },
    onError: (error) => toast.error(error.message),
  });

  const openEditor = (template?: Template) => {
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        name: template.name,
        type: template.type,
        trigger: template.trigger || 'custom',
        subject: template.subject || '',
        content: template.content,
        is_active: template.is_active,
      });
    } else {
      setSelectedTemplate(null);
      setFormData({
        name: '',
        type: 'whatsapp',
        trigger: 'custom',
        subject: '',
        content: '',
        is_active: true,
      });
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setSelectedTemplate(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.content) {
      toast.error('Please fill in required fields');
      return;
    }

    const templateData = {
      name: formData.name,
      type: formData.type,
      trigger: formData.trigger,
      subject: formData.type === 'email' ? formData.subject : null,
      content: formData.content,
      is_active: formData.is_active,
      variables: AVAILABLE_VARIABLES.filter((v) => formData.content.includes(v)),
    };

    if (selectedTemplate) {
      updateMutation.mutate({ id: selectedTemplate.id, ...templateData });
    } else {
      createMutation.mutate(templateData);
    }
  };

  const insertVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      content: prev.content + variable,
    }));
  };

  const getTypeIcon = (type: string) => {
    const t = TEMPLATE_TYPES.find((tt) => tt.value === type);
    return t?.icon || MessageSquare;
  };

  const openMetaDialog = (template: Template) => {
    // Meta requires lowercase with underscores only (hyphens not permitted)
    const slugName = template.name.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    setMetaTarget(template);
    setMetaForm({
      name: template.meta_template_name || slugName,
      category: 'UTILITY',
      language: 'en',
      body_text: template.content,
    });
    setShowMetaDialog(true);
  };

  const handleSubmitToMeta = async () => {
    if (!metaTarget) return;
    if (!metaForm.name || !metaForm.body_text) {
      toast.error('Please fill in all required fields');
      return;
    }

    const branch = branchFilter && branchFilter !== 'all' ? branchFilter : null;
    if (!branch) {
      toast.error('Please select a specific branch before submitting to Meta');
      return;
    }

    setIsSubmittingMeta(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-templates', {
        body: {
          action: 'create',
          branch_id: branch,
          template_data: {
            name: metaForm.name,
            category: metaForm.category,
            language: metaForm.language,
            body_text: metaForm.body_text,
            local_template_id: metaTarget.id,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Template submitted to Meta — status: ${data.status || 'PENDING'}`);
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      setShowMetaDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit template to Meta');
    } finally {
      setIsSubmittingMeta(false);
    }
  };

  const groupedTemplates = templates.reduce((acc, t) => {
    if (!acc[t.type]) acc[t.type] = [];
    acc[t.type].push(t);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Communication Templates</h3>
          <p className="text-sm text-muted-foreground">
            Manage SMS, Email, and WhatsApp message templates
          </p>
        </div>
        <Button onClick={() => openEditor()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {TEMPLATE_TYPES.map(({ value, label, icon: Icon }) => (
            <Card key={value}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label} Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!groupedTemplates[value]?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No {label} templates yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {groupedTemplates[value].map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{template.name}</p>
                            {!template.is_active && (
                              <Badge variant="secondary" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                            {value === 'whatsapp' && metaStatusBadge(template.meta_template_status)}
                          </div>
                          {value === 'whatsapp' && template.meta_template_name && (
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                              Meta: {template.meta_template_name}
                            </p>
                          )}
                          {value === 'whatsapp' && template.meta_template_status === 'REJECTED' && template.meta_rejection_reason && (
                            <p className="text-xs text-red-600 mt-0.5">
                              Reason: {template.meta_rejection_reason}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {template.content.slice(0, 80)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                          {value === 'whatsapp' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-700 hover:text-green-800 hover:bg-green-50 text-xs gap-1.5"
                              onClick={() => openMetaDialog(template)}
                              title="Submit to Meta for approval"
                              data-testid={`btn-submit-meta-${template.id}`}
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Submit to Meta</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditor(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Editor Drawer */}
      <Sheet open={showEditor} onOpenChange={setShowEditor}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedTemplate ? 'Edit Template' : 'Create Template'}
            </SheetTitle>
            <SheetDescription>
              Create reusable message templates with variable placeholders
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Welcome Message"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Trigger</Label>
                <Select
                  value={formData.trigger}
                  onValueChange={(v) => setFormData({ ...formData, trigger: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TRIGGERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.type === 'email' && (
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Email subject"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Message Content *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Type your message here..."
                rows={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Available Variables</Label>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_VARIABLES.map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => insertVariable(v)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <Label className="font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Only active templates appear in broadcast
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeEditor}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {selectedTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Submit to Meta Dialog */}
      <Dialog open={showMetaDialog} onOpenChange={setShowMetaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-green-600" />
              Submit to Meta
            </DialogTitle>
            <DialogDescription>
              Submit this template to WhatsApp for approval. Once approved, it can be sent to users who have not opted in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700">
                <strong>Note:</strong> Template names must be lowercase with underscores only (e.g., <span className="font-mono">welcome_message</span>). WhatsApp will auto-format the name if needed.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Template Name <span className="text-xs text-muted-foreground">(lowercase, underscores only)</span></Label>
              <Input
                value={metaForm.name}
                onChange={(e) => setMetaForm({ ...metaForm, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                placeholder="e.g., welcome_message"
                data-testid="input-meta-template-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={metaForm.category}
                  onValueChange={(v) => setMetaForm({ ...metaForm, category: v })}
                >
                  <SelectTrigger data-testid="select-meta-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {META_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={metaForm.language}
                  onValueChange={(v) => setMetaForm({ ...metaForm, language: v })}
                >
                  <SelectTrigger data-testid="select-meta-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {META_LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Body Text</Label>
              <Textarea
                value={metaForm.body_text}
                onChange={(e) => setMetaForm({ ...metaForm, body_text: e.target.value })}
                rows={5}
                placeholder="Template body text..."
                data-testid="textarea-meta-body"
              />
              <p className="text-xs text-muted-foreground">
                Replace <span className="font-mono">{"{{variable}}"}</span> with Meta positional parameters like <span className="font-mono">{"{{1}}"}</span>, <span className="font-mono">{"{{2}}"}</span>, etc. before submitting.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMetaDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitToMeta}
              disabled={isSubmittingMeta || !metaForm.name || !metaForm.body_text}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="btn-confirm-submit-meta"
            >
              {isSubmittingMeta ? (
                <><span className="animate-spin mr-2">⟳</span> Submitting...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Submit for Approval</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
