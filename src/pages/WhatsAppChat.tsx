import { useState, useRef, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useBranchContext } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';
import {
  MessageSquare, Send, Search, Phone, User,
  CheckCheck, Check, Clock, Paperclip, Smile, MoreVertical, Sparkles, Loader2, Plus, AlertTriangle, Bot, UserPlus, Image, FileText,
  Trash2, Ban, Eye, CircleDot, AlertCircle,
} from 'lucide-react';
import { AddLeadDrawer } from '@/components/leads/AddLeadDrawer';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatContact {
  phone_number: string;
  contact_name: string | null;
  member_id: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  is_unread?: boolean;
  bot_active?: boolean;
}

interface Message {
  id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  status: string;
  created_at: string;
  message_type: string;
}

interface ChatSettingsRow {
  phone_number: string;
  bot_active: boolean | null;
  is_unread: boolean | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatChatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM dd, yyyy');
}

function formatContactTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM dd');
}

function isAiNotConfiguredError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('not configured') ||
    lower.includes('api key') ||
    lower.includes('openai') ||
    lower.includes('configuration') ||
    lower.includes('not set up')
  );
}

type ChatFilter = 'all' | 'unread' | 'needs_human' | 'my_chats';

function normalizePhone(phone: string): string {
  return phone.replace(/^\+/, '');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhatsAppChatPage() {
  const { selectedBranch } = useBranchContext();
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');

  // New chat dialog state
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [botActive, setBotActive] = useState(true);
  const [convertLeadOpen, setConvertLeadOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachUploading, setAttachUploading] = useState(false);

  // Clear chat confirmation
  const [clearChatConfirmOpen, setClearChatConfirmOpen] = useState(false);
  // Transfer to staff
  const [transferStaffOpen, setTransferStaffOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch bot_active state for selected contact
  useEffect(() => {
    if (!selectedContact || !selectedBranch || selectedBranch === 'all') {
      setBotActive(true);
      return;
    }
    supabase
      .from('whatsapp_chat_settings')
      .select('bot_active')
      .eq('branch_id', selectedBranch)
      .eq('phone_number', selectedContact.phone_number)
      .maybeSingle()
      .then(({ data }) => {
        setBotActive(data?.bot_active ?? true);
      });
  }, [selectedContact, selectedBranch]);

  // Realtime subscription: refresh messages + contacts + chat settings on any change
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
        queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chat_settings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-chat-settings'] });
        queryClient.invalidateQueries({ queryKey: ['whatsapp-unread-count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Chat settings query for triage
  const { data: chatSettings = [] } = useQuery<ChatSettingsRow[]>({
    queryKey: ['whatsapp-chat-settings', selectedBranch],
    queryFn: async () => {
      if (!selectedBranch || selectedBranch === 'all') return [];
      const { data, error } = await supabase
        .from('whatsapp_chat_settings')
        .select('phone_number, bot_active, is_unread')
        .eq('branch_id', selectedBranch);
      if (error) throw error;
      return (data ?? []) as ChatSettingsRow[];
    },
  });

  // Staff list for Transfer to Staff
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-list-for-transfer'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role, profiles:user_id(id, full_name, avatar_url, email)')
        .in('role', ['owner', 'admin', 'manager', 'staff']);
      if (error) throw error;
      // Deduplicate by user_id
      const seen = new Set<string>();
      return (data ?? []).filter((r: any) => {
        if (seen.has(r.user_id)) return false;
        seen.add(r.user_id);
        return true;
      }).map((r: any) => ({
        id: r.user_id,
        full_name: r.profiles?.full_name || r.profiles?.email || 'Unknown',
        avatar_url: r.profiles?.avatar_url,
        role: r.role,
      }));
    },
    enabled: transferStaffOpen,
  });

  // Build a map for quick lookup
  const settingsMap = new Map<string, ChatSettingsRow>();
  chatSettings.forEach(s => settingsMap.set(s.phone_number, s));

  // Contacts query — builds a unique contact list from whatsapp_messages
  const { data: contacts = [] } = useQuery<ChatContact[]>({
    queryKey: ['whatsapp-contacts', selectedBranch],
    queryFn: async (): Promise<ChatContact[]> => {
      const branchFilter = selectedBranch !== 'all' ? selectedBranch : undefined;
      let q = supabase
        .from('whatsapp_messages')
        .select('phone_number, contact_name, member_id, content, created_at, direction')
        .order('created_at', { ascending: false });
      if (branchFilter) q = q.eq('branch_id', branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      const contactMap = new Map<string, ChatContact>();
      (data || []).forEach((msg: {
        phone_number: string;
        contact_name: string | null;
        member_id: string | null;
        content: string | null;
        created_at: string;
        direction: string;
      }) => {
        if (!contactMap.has(msg.phone_number)) {
          contactMap.set(msg.phone_number, {
            phone_number: msg.phone_number,
            contact_name: msg.contact_name,
            member_id: msg.member_id,
            last_message: msg.content || '',
            last_message_time: msg.created_at,
            unread_count: 0,
          });
        }
      });
      return Array.from(contactMap.values());
    },
  });

  // Enrich contacts with settings (normalize phone for matching)
  const enrichedContacts: ChatContact[] = contacts.map(c => {
    const normalized = normalizePhone(c.phone_number);
    const s = settingsMap.get(c.phone_number) || settingsMap.get(normalized) || settingsMap.get('+' + normalized);
    return {
      ...c,
      is_unread: s?.is_unread ?? false,
      bot_active: s?.bot_active ?? true,
    };
  });

  // Messages query for the selected contact
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['whatsapp-messages', selectedContact?.phone_number, selectedBranch],
    queryFn: async (): Promise<Message[]> => {
      if (!selectedContact) return [];
      let q = supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('phone_number', selectedContact.phone_number)
        .order('created_at', { ascending: true });
      if (selectedBranch !== 'all') q = q.eq('branch_id', selectedBranch);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Message[];
    },
    enabled: !!selectedContact,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedContact) throw new Error('No contact selected');
      if (!selectedBranch || selectedBranch === 'all') {
        throw new Error('Please select a specific branch before sending messages');
      }

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .insert({
          branch_id: selectedBranch,
          phone_number: selectedContact.phone_number,
          contact_name: selectedContact.contact_name,
          member_id: selectedContact.member_id,
          content,
          direction: 'outbound',
          status: 'pending',
          message_type: 'text',
        })
        .select()
        .single();
      if (error) throw error;

      const messageId: string = data.id;

      try {
        const { error: sendError } = await supabase.functions.invoke('send-whatsapp', {
          body: {
            message_id: messageId,
            phone_number: selectedContact.phone_number,
            content,
            branch_id: selectedBranch,
          },
        });

        if (sendError) {
          console.warn('WhatsApp delivery failed (message saved as pending):', sendError);
          toast.info('Message saved. WhatsApp delivery failed — check integration settings.');
        } else {
          const { error: updateErr } = await supabase
            .from('whatsapp_messages')
            .update({ status: 'sent' })
            .eq('id', messageId);
          if (updateErr) {
            console.warn('Failed to update message status to sent:', updateErr.message);
          }
        }

        // Auto-pause bot when staff sends a manual message
        if (selectedBranch !== 'all') {
          await supabase.from('whatsapp_chat_settings').upsert(
            {
              branch_id: selectedBranch,
              phone_number: selectedContact.phone_number,
              bot_active: false,
              paused_at: new Date().toISOString(),
            },
            { onConflict: 'branch_id,phone_number' }
          );
          setBotActive(false);
        }
      } catch (apiErr) {
        console.warn('send-whatsapp invocation error:', apiErr);
      }

      return data;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to send message'),
  });

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Filter contacts by search + triage tab
  const filteredContacts = enrichedContacts.filter((c: ChatContact) => {
    const matchesSearch = c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone_number.includes(searchQuery);
    if (!matchesSearch) return false;
    if (chatFilter === 'unread') return c.is_unread === true;
    if (chatFilter === 'needs_human') return c.bot_active === false;
    return true;
  });

  const handleSend = () => {
    if (selectedBranch === 'all') {
      toast.warning('Please select a specific branch from the selector before sending messages');
      return;
    }
    if (newMessage.trim()) sendMessage.mutate(newMessage.trim());
  };

  const handleEmojiSelect = useCallback((emoji: any) => {
    setNewMessage(prev => prev + emoji.native);
    setEmojiOpen(false);
  }, []);

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact || !selectedBranch || selectedBranch === 'all') return;
    setAttachUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `whatsapp-attachments/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
      const mediaUrl = urlData.publicUrl;

      const { data: msgData, error: msgError } = await supabase
        .from('whatsapp_messages')
        .insert({
          branch_id: selectedBranch,
          phone_number: selectedContact.phone_number,
          contact_name: selectedContact.contact_name,
          member_id: selectedContact.member_id,
          content: mediaUrl,
          direction: 'outbound',
          status: 'pending',
          message_type: file.type.startsWith('image/') ? 'image' : 'document',
        })
        .select()
        .single();
      if (msgError) throw msgError;

      await supabase.functions.invoke('send-whatsapp', {
        body: {
          message_id: msgData.id,
          phone_number: selectedContact.phone_number,
          content: mediaUrl,
          branch_id: selectedBranch,
          message_type: file.type.startsWith('image/') ? 'image' : 'document',
          media_url: mediaUrl,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
      toast.success('Attachment sent');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send attachment');
    } finally {
      setAttachUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAiSuggest = async () => {
    if (!selectedContact || messages.length === 0) {
      toast.error('No conversation selected or no messages to analyze');
      return;
    }
    setAiSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-auto-reply', {
        body: {
          contact_name: selectedContact.contact_name,
          phone_number: selectedContact.phone_number,
          recent_messages: messages.slice(-10).map(m => ({
            content: m.content,
            direction: m.direction,
          })),
          context_type: 'general',
        },
      });

      if (error) {
        const msg = (error as { message?: string }).message || '';
        if (isAiNotConfiguredError(msg)) {
          toast.warning('AI reply requires configuration in Integration Settings');
        } else {
          toast.error(msg || 'Failed to get AI suggestion');
        }
        return;
      }

      if (data?.error) {
        if (isAiNotConfiguredError(String(data.error))) {
          toast.warning('AI reply requires configuration in Integration Settings');
        } else {
          toast.error(String(data.error));
        }
        return;
      }

      if (data?.suggested_reply) {
        setNewMessage(data.suggested_reply);
        toast.success('AI suggestion ready — review and send!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to get AI suggestion';
      if (isAiNotConfiguredError(msg)) {
        toast.warning('AI reply requires configuration in Integration Settings');
      } else {
        toast.error(msg);
      }
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleOpenNewChat = () => {
    if (selectedBranch === 'all') {
      toast.warning('Please select a specific branch before starting a new chat');
      return;
    }
    setNewChatPhone('');
    setNewChatName('');
    setNewChatOpen(true);
  };

  const handleStartNewChat = () => {
    const phone = newChatPhone.trim();
    if (!phone) {
      toast.error('Phone number is required');
      return;
    }
    const contact: ChatContact = {
      phone_number: phone,
      contact_name: newChatName.trim() || null,
      member_id: null,
      last_message: '',
      last_message_time: new Date().toISOString(),
      unread_count: 0,
    };
    setSelectedContact(contact);
    setNewChatOpen(false);
    setNewChatPhone('');
    setNewChatName('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read': return <CheckCheck className="h-3.5 w-3.5 text-sky-400" />;
      case 'delivered': return <CheckCheck className="h-3.5 w-3.5 text-white/50" />;
      case 'sent': return <Check className="h-3.5 w-3.5 text-white/50" />;
      default: return <Clock className="h-3.5 w-3.5 text-white/40" />;
    }
  };

  // Auto-read: mark as read when selecting a contact
  const handleSelectContact = async (contact: ChatContact) => {
    setSelectedContact(contact);
    if (contact.is_unread && selectedBranch && selectedBranch !== 'all') {
      // Normalize phone to match both +91xxx and 91xxx formats
      const normalized = normalizePhone(contact.phone_number);
      await supabase.from('whatsapp_chat_settings')
        .update({ is_unread: false })
        .eq('branch_id', selectedBranch)
        .or(`phone_number.eq.${contact.phone_number},phone_number.eq.${normalized},phone_number.eq.+${normalized}`);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chat-settings'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-unread-count'] });
    }
  };

  // Clear chat with database deletion
  const handleClearChat = async () => {
    if (!selectedContact || !selectedBranch || selectedBranch === 'all') return;
    const { error } = await supabase
      .from('whatsapp_messages')
      .delete()
      .eq('phone_number', selectedContact.phone_number)
      .eq('branch_id', selectedBranch);
    if (error) {
      toast.error('Failed to delete chat: ' + error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
      setSelectedContact(null);
      toast.success('Chat history permanently deleted');
    }
    setClearChatConfirmOpen(false);
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  messages.forEach((msg) => {
    const dateKey = format(new Date(msg.created_at), 'yyyy-MM-dd');
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateKey, msgs: [msg] });
    }
  });

  const isBranchUnselected = selectedBranch === 'all';

  // Triage tab counts
  const unreadCount = enrichedContacts.filter(c => c.is_unread).length;
  const needsHumanCount = enrichedContacts.filter(c => c.bot_active === false).length;

  return (
    <AppLayout>
      <div className="h-[calc(100vh-5rem)] p-4">
        <div className="h-full rounded-2xl border border-border/50 shadow-xl overflow-hidden flex bg-card">

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <div className="w-[340px] border-r border-border/50 flex flex-col bg-card">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-border/30">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <MessageSquare className="h-4 w-4 text-emerald-500" />
                  </div>
                  Chats
                </h2>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="rounded-full text-xs">{contacts.length}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-emerald-600 hover:bg-emerald-500/10"
                    onClick={handleOpenNewChat}
                    title="Start new chat"
                    data-testid="button-new-chat"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
                  data-testid="input-search-contacts"
                />
              </div>
              {/* Triage Tabs */}
              <div className="flex gap-1">
                {([
                  { key: 'all' as ChatFilter, label: 'All', count: contacts.length },
                  { key: 'unread' as ChatFilter, label: 'Unread', count: unreadCount },
                  { key: 'needs_human' as ChatFilter, label: 'Needs Human', count: needsHumanCount },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setChatFilter(tab.key)}
                    className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors ${
                      chatFilter === tab.key
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`ml-1 text-[10px] ${chatFilter === tab.key ? 'opacity-80' : ''}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact List */}
            <ScrollArea className="flex-1">
              {filteredContacts.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {chatFilter === 'all' ? 'No conversations yet' : `No ${chatFilter === 'unread' ? 'unread' : 'human-needed'} chats`}
                  </p>
                  {chatFilter === 'all' && (
                    <p className="text-xs mt-1 text-muted-foreground/60">
                      Use the + button to start a new chat
                    </p>
                  )}
                </div>
              ) : (
                filteredContacts.map((contact: ChatContact) => (
                  <div
                    key={contact.phone_number}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-muted/50 ${
                      selectedContact?.phone_number === contact.phone_number
                        ? 'bg-primary/5 border-l-2 border-l-primary'
                        : 'border-l-2 border-l-transparent'
                    }`}
                    onClick={() => handleSelectContact(contact)}
                    data-testid={`contact-item-${contact.phone_number}`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-11 w-11 ring-2 ring-background">
                        <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 font-bold text-sm">
                          {contact.contact_name?.[0]?.toUpperCase() || <User className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                      {/* Visual indicators */}
                      {contact.is_unread && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-background" />
                      )}
                      {contact.bot_active === false && !contact.is_unread && (
                        <span className="absolute -top-0.5 -right-0.5">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {contact.contact_name || contact.phone_number}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">
                          {formatContactTime(contact.last_message_time)}
                        </span>
                      </div>
                      <p className="text-[13px] text-muted-foreground line-clamp-1 mt-0.5 leading-snug">{contact.last_message}</p>
                    </div>

                    {contact.unread_count > 0 && (
                      <Badge className="rounded-full h-5 min-w-[20px] flex items-center justify-center bg-emerald-500 text-white text-[10px] p-0">
                        {contact.unread_count}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </ScrollArea>
          </div>

          {/* ── Chat Area ────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedContact ? (
              <>
                {/* Chat Header */}
                <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between bg-card flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 font-bold">
                        {selectedContact.contact_name?.[0]?.toUpperCase() || <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm break-words [overflow-wrap:anywhere]">
                        {selectedContact.contact_name || selectedContact.phone_number}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {selectedContact.phone_number}
                        {selectedContact.member_id && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-1">Member</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Convert to Lead */}
                    {!selectedContact.member_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs rounded-lg"
                        onClick={() => setConvertLeadOpen(true)}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Convert to Lead
                      </Button>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">AI Bot</span>
                      <Switch
                        checked={botActive}
                        onCheckedChange={async (checked) => {
                          setBotActive(checked);
                          if (selectedContact && selectedBranch && selectedBranch !== 'all') {
                            await supabase.from('whatsapp_chat_settings').upsert(
                              {
                                branch_id: selectedBranch,
                                phone_number: selectedContact.phone_number,
                                bot_active: checked,
                                ...(!checked ? { paused_at: new Date().toISOString() } : { paused_at: null }),
                              },
                              { onConflict: 'branch_id,phone_number' }
                            );
                            toast.success(checked ? 'AI Bot enabled' : 'AI Bot paused for this contact');
                          }
                        }}
                        className="scale-75"
                      />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {selectedContact.member_id && (
                          <DropdownMenuItem onClick={() => navigate(`/members`)}>
                            <Eye className="h-4 w-4 mr-2" /> View Profile
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setClearChatConfirmOpen(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Clear Chat
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTransferStaffOpen(true)}
                        >
                          <UserPlus className="h-4 w-4 mr-2" /> Transfer to Staff
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" disabled>
                          <Ban className="h-4 w-4 mr-2" /> Block Contact
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Branch-not-selected inline notice */}
                {isBranchUnselected && (
                  <div className="flex items-center gap-2.5 px-5 py-2.5 bg-yellow-500/10 border-b border-yellow-500/20 text-sm text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Please select a specific branch from the branch selector to send messages.
                    </span>
                  </div>
                )}

                {/* Messages Area — fixed height with overflow scroll */}
                <div className="flex-1 min-h-0">
                  <div
                    ref={messagesContainerRef}
                    className="h-full overflow-y-auto p-4 space-y-1"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                  >
                    {groupedMessages.length === 0 && (
                      <div className="flex items-center justify-center py-16 text-muted-foreground">
                        <div className="text-center">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No messages yet. Send the first one!</p>
                        </div>
                      </div>
                    )}
                    {groupedMessages.map((group) => (
                      <div key={group.date}>
                        {/* Date divider */}
                        <div className="flex items-center justify-center my-4">
                          <div className="px-3 py-1 rounded-lg bg-muted/80 text-xs text-muted-foreground font-medium shadow-sm">
                            {formatChatDate(group.msgs[0].created_at)}
                          </div>
                        </div>
                        {group.msgs.map((msg: Message) => {
                          // Detect AI Lead Captured marker
                          const leadCapturedMatch = msg.content?.match(/\[AI_LEAD_CAPTURED:([a-f0-9-]+)\]/);
                          if (leadCapturedMatch) {
                            const leadId = leadCapturedMatch[1];
                            return (
                              <div key={msg.id} className="flex justify-center my-4">
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 text-center shadow-lg shadow-emerald-500/5 animate-pulse-once">
                                  <div className="flex items-center gap-2 justify-center mb-1">
                                    <Sparkles className="h-4 w-4 text-emerald-500" />
                                    <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">AI Successfully Captured Lead</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-2">The AI collected all required information and created a lead in your CRM.</p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-xs rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                                    onClick={() => navigate('/leads')}
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    View Lead
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={msg.id}
                              className={`flex mb-1 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                              data-testid={`message-${msg.id}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm break-words overflow-hidden ${
                                  msg.direction === 'outbound'
                                    ? 'bg-emerald-600 text-white rounded-br-md'
                                    : 'bg-card border border-border/50 text-foreground rounded-bl-md'
                                }`}
                              >
                                {msg.message_type !== 'text' && (
                                  <div className={`flex items-center gap-1 mb-1 text-[10px] ${msg.direction === 'outbound' ? 'text-white/50' : 'text-muted-foreground'}`}>
                                    {msg.message_type === 'image' && <><Image className="h-3 w-3" /> Photo</>}
                                    {msg.message_type === 'template' && <><FileText className="h-3 w-3" /> Template</>}
                                    {!['text','image','template'].includes(msg.message_type) && <><Paperclip className="h-3 w-3" /> {msg.message_type}</>}
                                  </div>
                                )}
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words [word-break:break-word] [overflow-wrap:anywhere] w-full">{msg.content}</p>
                                <div
                                  className={`flex items-center justify-end gap-1 mt-1 ${
                                    msg.direction === 'outbound' ? 'text-white/60' : 'text-muted-foreground'
                                  }`}
                                >
                                  <span className="text-[10px]">{format(new Date(msg.created_at), 'HH:mm')}</span>
                                  {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Message Input */}
                <div className="px-4 py-3 border-t border-border/30 bg-card flex-shrink-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx"
                    onChange={handleAttachment}
                  />
                  <div className="flex items-center gap-2">
                    <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-xl text-muted-foreground hover:text-foreground flex-shrink-0"
                          title="Emoji picker"
                        >
                          <Smile className="h-5 w-5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="top" align="start" className="w-auto p-0 border-0">
                        <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" previewPosition="none" skinTonePosition="none" />
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-muted-foreground hover:text-foreground flex-shrink-0"
                      title="Attach file"
                      disabled={attachUploading || isBranchUnselected}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {attachUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-violet-500 hover:text-violet-600 hover:bg-violet-500/10 flex-shrink-0"
                      onClick={handleAiSuggest}
                      disabled={aiSuggesting || messages.length === 0}
                      title="AI Suggest Reply"
                      data-testid="button-ai-suggest"
                    >
                      {aiSuggesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    </Button>
                    <Input
                      placeholder={isBranchUnselected ? 'Select a branch to send messages…' : 'Type a message…'}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      disabled={isBranchUnselected}
                      className="flex-1 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 disabled:opacity-60"
                      data-testid="input-new-message"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!newMessage.trim() || sendMessage.isPending || isBranchUnselected}
                      size="icon"
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center mb-4">
                    <MessageSquare className="h-10 w-10 text-emerald-500/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">WhatsApp Chat</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mb-4">
                    Select a conversation from the sidebar, or start a new one with the + button.
                  </p>
                  {!isBranchUnselected && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={handleOpenNewChat}
                      data-testid="button-start-new-chat-empty"
                    >
                      <Plus className="h-4 w-4" /> New Chat
                    </Button>
                  )}
                  {isBranchUnselected && (
                    <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-2 max-w-xs mx-auto">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      Select a specific branch from the selector above to send messages
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── New Chat Dialog ────────────────────────────────────────────────── */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <MessageSquare className="h-4 w-4 text-emerald-500" />
              </div>
              New Chat
            </DialogTitle>
            <DialogDescription>
              Enter a phone number to start a new WhatsApp conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-chat-phone">Phone Number *</Label>
              <Input
                id="new-chat-phone"
                placeholder="+91 98765 43210"
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartNewChat()}
                data-testid="input-new-chat-phone"
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g. +91 for India)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-chat-name">Contact Name (optional)</Label>
              <Input
                id="new-chat-name"
                placeholder="e.g. John Doe"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartNewChat()}
                data-testid="input-new-chat-name"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewChatOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStartNewChat}
              disabled={!newChatPhone.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-start-chat"
            >
              Open Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Clear Chat Confirmation Dialog ──────────────────────────────── */}
      <Dialog open={clearChatConfirmOpen} onOpenChange={setClearChatConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Chat History
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this entire chat history? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClearChatConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearChat}>
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer to Staff Dialog */}
      <Dialog open={transferStaffOpen} onOpenChange={setTransferStaffOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Transfer to Staff
            </DialogTitle>
            <DialogDescription>
              Assign this conversation to a staff member.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-64">
            <div className="space-y-1">
              {staffList.map((staff: any) => (
                <button
                  key={staff.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/80 transition-colors text-left"
                  onClick={async () => {
                    if (!selectedContact || !selectedBranch || selectedBranch === 'all') return;
                    await supabase.from('whatsapp_chat_settings').upsert(
                      {
                        branch_id: selectedBranch,
                        phone_number: selectedContact.phone_number,
                        assigned_to: staff.id,
                        bot_active: false,
                      },
                      { onConflict: 'branch_id,phone_number' }
                    );
                    setBotActive(false);
                    queryClient.invalidateQueries({ queryKey: ['whatsapp-chat-settings'] });
                    setTransferStaffOpen(false);
                    toast.success(`Chat assigned to ${staff.full_name}`);
                  }}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {staff.full_name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{staff.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{staff.role}</p>
                  </div>
                </button>
              ))}
              {staffList.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Loading staff...</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Convert to Lead Drawer */}
      <AddLeadDrawer
        open={convertLeadOpen}
        onOpenChange={setConvertLeadOpen}
        defaultBranchId={selectedBranch !== 'all' ? selectedBranch : undefined}
      />
    </AppLayout>
  );
}
