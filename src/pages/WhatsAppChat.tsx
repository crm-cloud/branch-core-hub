import { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useBranchContext } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';
import { 
  MessageSquare, Send, Search, Phone, User, 
  CheckCheck, Check, Clock, Paperclip, Smile, MoreVertical
} from 'lucide-react';

interface ChatContact {
  phone_number: string;
  contact_name: string | null;
  member_id: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

interface Message {
  id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  status: string;
  created_at: string;
  message_type: string;
}

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

export default function WhatsAppChatPage() {
  const { selectedBranch } = useBranchContext();
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
        queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: contacts = [] } = useQuery({
    queryKey: ['whatsapp-contacts', selectedBranch],
    queryFn: async () => {
      const branchFilter = selectedBranch !== 'all' ? selectedBranch : undefined;
      let query = supabase.from('whatsapp_messages').select('phone_number, contact_name, member_id, content, created_at, direction').order('created_at', { ascending: false });
      if (branchFilter) query = query.eq('branch_id', branchFilter);
      const { data, error } = await query;
      if (error) throw error;
      const contactMap = new Map<string, ChatContact>();
      data?.forEach((msg: any) => {
        if (!contactMap.has(msg.phone_number)) {
          contactMap.set(msg.phone_number, {
            phone_number: msg.phone_number, contact_name: msg.contact_name, member_id: msg.member_id,
            last_message: msg.content || '', last_message_time: msg.created_at, unread_count: 0,
          });
        }
      });
      return Array.from(contactMap.values());
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['whatsapp-messages', selectedContact?.phone_number, selectedBranch],
    queryFn: async () => {
      if (!selectedContact) return [];
      let query = supabase.from('whatsapp_messages').select('*').eq('phone_number', selectedContact.phone_number).order('created_at', { ascending: true });
      if (selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
      const { data, error } = await query;
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedContact,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedContact || !selectedBranch || selectedBranch === 'all') throw new Error('Select a contact and branch');
      const { data, error } = await supabase.from('whatsapp_messages').insert({
        branch_id: selectedBranch, phone_number: selectedContact.phone_number, contact_name: selectedContact.contact_name,
        member_id: selectedContact.member_id, content, direction: 'outbound', status: 'pending', message_type: 'text',
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
    },
    onError: (error: any) => toast.error(error.message || 'Failed to send message'),
  });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const filteredContacts = contacts.filter((c: ChatContact) =>
    (c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone_number.includes(searchQuery))
  );

  const handleSend = () => { if (newMessage.trim()) sendMessage.mutate(newMessage.trim()); };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read': return <CheckCheck className="h-3.5 w-3.5 text-sky-400" />;
      case 'delivered': return <CheckCheck className="h-3.5 w-3.5 text-white/50" />;
      case 'sent': return <Check className="h-3.5 w-3.5 text-white/50" />;
      default: return <Clock className="h-3.5 w-3.5 text-white/40" />;
    }
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

  return (
    <AppLayout>
      <div className="h-[calc(100vh-5rem)] p-4">
        <div className="h-full rounded-2xl border border-border/50 shadow-xl overflow-hidden flex bg-card">
          {/* Sidebar */}
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
                <Badge variant="secondary" className="rounded-full text-xs">{contacts.length}</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search or start new chat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
                />
              </div>
            </div>

            {/* Contact List */}
            <ScrollArea className="flex-1">
              {filteredContacts.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No conversations yet</p>
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
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className="relative">
                      <Avatar className="h-11 w-11 ring-2 ring-background">
                        <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 font-bold text-sm">
                          {contact.contact_name?.[0]?.toUpperCase() || <User className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online indicator */}
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
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
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{contact.last_message}</p>
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

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedContact ? (
              <>
                {/* Chat Header */}
                <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between bg-card">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 font-bold">
                        {selectedContact.contact_name?.[0]?.toUpperCase() || <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">
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
                  <Button variant="ghost" size="icon" className="rounded-xl">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-1" style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}>
                      {groupedMessages.map((group) => (
                        <div key={group.date}>
                          {/* Date divider */}
                          <div className="flex items-center justify-center my-4">
                            <div className="px-3 py-1 rounded-lg bg-muted/80 text-xs text-muted-foreground font-medium shadow-sm">
                              {formatChatDate(group.msgs[0].created_at)}
                            </div>
                          </div>
                          {group.msgs.map((msg: Message) => (
                            <div
                              key={msg.id}
                              className={`flex mb-1 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[65%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                  msg.direction === 'outbound'
                                    ? 'bg-emerald-600 text-white rounded-br-md'
                                    : 'bg-card border border-border/50 text-foreground rounded-bl-md'
                                }`}
                              >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                <div className={`flex items-center justify-end gap-1 mt-1 ${
                                  msg.direction === 'outbound' ? 'text-white/60' : 'text-muted-foreground'
                                }`}>
                                  <span className="text-[10px]">{format(new Date(msg.created_at), 'HH:mm')}</span>
                                  {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>

                {/* Message Input */}
                <div className="px-4 py-3 border-t border-border/30 bg-card">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-foreground flex-shrink-0">
                      <Smile className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-foreground flex-shrink-0">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      className="flex-1 rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
                    />
                    <Button 
                      onClick={handleSend} 
                      disabled={!newMessage.trim() || sendMessage.isPending}
                      size="icon"
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center mb-4">
                    <MessageSquare className="h-10 w-10 text-emerald-500/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">WhatsApp Chat</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Select a conversation from the sidebar to start chatting with your members</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
