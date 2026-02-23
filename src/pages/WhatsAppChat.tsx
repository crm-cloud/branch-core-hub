import { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { useBranches } from '@/hooks/useBranches';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  MessageSquare, Send, Search, Phone, User, 
  CheckCheck, Check, Clock, Image, Paperclip
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

export default function WhatsAppChatPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: branches = [] } = useBranches();
  const queryClient = useQueryClient();

  // Realtime subscription for new WhatsApp messages
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
          queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);


  // Fetch contacts with latest messages
  const { data: contacts = [] } = useQuery({
    queryKey: ['whatsapp-contacts', selectedBranch],
    queryFn: async () => {
      const branchFilter = selectedBranch !== 'all' ? selectedBranch : undefined;
      
      let query = supabase
        .from('whatsapp_messages')
        .select('phone_number, contact_name, member_id, content, created_at, direction')
        .order('created_at', { ascending: false });

      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by phone number and get latest message
      const contactMap = new Map<string, ChatContact>();
      data?.forEach((msg: any) => {
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

  // Fetch messages for selected contact
  const { data: messages = [] } = useQuery({
    queryKey: ['whatsapp-messages', selectedContact?.phone_number, selectedBranch],
    queryFn: async () => {
      if (!selectedContact) return [];

      let query = supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('phone_number', selectedContact.phone_number)
        .order('created_at', { ascending: true });

      if (selectedBranch !== 'all') {
        query = query.eq('branch_id', selectedBranch);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedContact,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedContact || !selectedBranch || selectedBranch === 'all') {
        throw new Error('Please select a contact and branch');
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

      // TODO: Call WhatsApp API edge function to actually send
      // await supabase.functions.invoke('send-whatsapp', { body: { messageId: data.id } });

      return data;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send message');
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredContacts = contacts.filter((c: ChatContact) =>
    (c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_number.includes(searchQuery))
  );

  const handleSend = () => {
    if (newMessage.trim()) {
      sendMessage.mutate(newMessage.trim());
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'sent':
        return <Check className="h-3 w-3 text-muted-foreground" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-green-500" />
            WhatsApp Chat
          </h1>
          <BranchSelector
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={setSelectedBranch}
            showAllOption={true}
          />
        </div>

        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Contacts List */}
          <Card className="col-span-4 flex flex-col">
            <CardHeader className="pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-[calc(100vh-16rem)]">
                {filteredContacts.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No conversations yet
                  </div>
                ) : (
                  filteredContacts.map((contact: ChatContact) => (
                    <div
                      key={contact.phone_number}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 border-b ${
                        selectedContact?.phone_number === contact.phone_number ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedContact(contact)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {contact.contact_name?.[0]?.toUpperCase() || <User className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">
                            {contact.contact_name || contact.phone_number}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(contact.last_message_time), 'HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.last_message}
                        </p>
                      </div>
                      {contact.unread_count > 0 && (
                        <Badge variant="default" className="rounded-full">
                          {contact.unread_count}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="col-span-8 flex flex-col">
            {selectedContact ? (
              <>
                {/* Chat Header */}
                <CardHeader className="border-b py-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {selectedContact.contact_name?.[0]?.toUpperCase() || <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">
                        {selectedContact.contact_name || selectedContact.phone_number}
                      </CardTitle>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {selectedContact.phone_number}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {/* Messages */}
                <CardContent className="flex-1 p-4 overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-24rem)]">
                    <div className="space-y-4">
                      {messages.map((msg: Message) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              msg.direction === 'outbound'
                                ? 'bg-green-500 text-white'
                                : 'bg-muted'
                            }`}
                          >
                            <p>{msg.content}</p>
                            <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                              msg.direction === 'outbound' ? 'text-green-100' : 'text-muted-foreground'
                            }`}>
                              {format(new Date(msg.created_at), 'HH:mm')}
                              {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>

                {/* Message Input */}
                <div className="p-4 border-t">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Image className="h-5 w-5" />
                    </Button>
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleSend} 
                      disabled={!newMessage.trim() || sendMessage.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
