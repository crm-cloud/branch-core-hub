import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Plus, Edit, Trash2, MessageSquare, Mail, Phone, Copy } from 'lucide-react';
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
}

export function TemplateManager() {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{template.name}</p>
                            {!template.is_active && (
                              <Badge variant="secondary" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {template.content.slice(0, 80)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
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
    </div>
  );
}
