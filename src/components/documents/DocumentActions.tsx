import { Button } from '@/components/ui/button';
import { Download, Printer, MessageCircle, Mail } from 'lucide-react';
import { downloadBlob, printBlob } from '@/utils/pdfBlob';
import { toast } from 'sonner';

interface DocumentActionsProps {
  filename: string;
  build: () => Blob | Promise<Blob>;
  whatsappNumber?: string | null;
  email?: string | null;
  message?: string;
  showReceipt?: boolean;
  buildReceipt?: () => Blob | Promise<Blob>;
  receiptFilename?: string;
  size?: 'sm' | 'default';
}

/**
 * Shared action bar for branded documents.
 * Uses jsPDF blobs from src/utils/pdfBlob.ts.
 */
export function DocumentActions({
  filename, build, whatsappNumber, email, message,
  showReceipt, buildReceipt, receiptFilename, size = 'sm',
}: DocumentActionsProps) {
  const run = async (action: 'download' | 'print' | 'whatsapp' | 'email', target: 'invoice' | 'receipt' = 'invoice') => {
    try {
      const builder = target === 'receipt' ? buildReceipt! : build;
      const name = target === 'receipt' ? (receiptFilename || filename) : filename;
      const blob = await builder();
      if (action === 'download') {
        downloadBlob(blob, name);
      } else if (action === 'print') {
        printBlob(blob);
      } else if (action === 'whatsapp') {
        downloadBlob(blob, name);
        const text = encodeURIComponent(message || `Sharing ${name}`);
        const num = (whatsappNumber || '').replace(/\D/g, '');
        window.open(`https://wa.me/${num}?text=${text}`, '_blank');
        toast.info('PDF downloaded — attach it in WhatsApp');
      } else if (action === 'email') {
        downloadBlob(blob, name);
        const subject = encodeURIComponent(name);
        const body = encodeURIComponent(message || `Please find attached: ${name}`);
        window.location.href = `mailto:${email || ''}?subject=${subject}&body=${body}`;
        toast.info('PDF downloaded — attach it in your email client');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate PDF');
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} variant="default" onClick={() => run('download')}>
        <Download className="h-4 w-4 mr-2" />
        Download {showReceipt ? 'Invoice' : 'PDF'}
      </Button>
      {showReceipt && buildReceipt && (
        <Button size={size} variant="secondary" onClick={() => run('download', 'receipt')}>
          <Download className="h-4 w-4 mr-2" />
          Download Receipt
        </Button>
      )}
      <Button size={size} variant="outline" onClick={() => run('print')}>
        <Printer className="h-4 w-4 mr-2" />
        Print
      </Button>
      <Button size={size} variant="outline" onClick={() => run('whatsapp')}>
        <MessageCircle className="h-4 w-4 mr-2" />
        WhatsApp
      </Button>
      <Button size={size} variant="outline" onClick={() => run('email')}>
        <Mail className="h-4 w-4 mr-2" />
        Email
      </Button>
    </div>
  );
}
