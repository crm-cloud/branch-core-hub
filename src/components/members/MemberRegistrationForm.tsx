import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, Save, FileSignature, Eraser, Dumbbell, Shield, HeartPulse, User, Calendar, MapPin, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { e } from '@/utils/htmlEscape';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PARQ_QUESTIONS,
  PRIMARY_GOALS,
  MORE_GOALS,
  HEALTH_CONDITION_OPTIONS,
  parseHealthConditions,
  joinHealthConditions,
} from '@/lib/registration/healthQuestions';

interface RegistrationFormData {
  memberName: string;
  memberCode: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  planName?: string;
  startDate?: string;
  endDate?: string;
  pricePaid?: number;
  branchName?: string;
  memberId?: string;
  fitnessGoals?: string;
  medicalConditions?: string;
  governmentIdType?: string;
  governmentIdNumber?: string;
}

interface MemberRegistrationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: RegistrationFormData;
}

interface TermClause { title: string; body: string; }

const DEFAULT_TERMS: TermClause[] = [
  { title: 'Health Declaration & Assumption of Risk', body: 'I confirm that I am medically fit to participate in physical exercise. I understand that fitness activities involve inherent risks, including injury, illness, or in rare cases, death. I voluntarily assume all such risks and agree that the fitness centre, its owners, staff, and trainers shall not be held liable for any injury, loss, or damage sustained while using the facility.' },
  { title: 'Medical Disclosure & Responsibility', body: 'I agree to disclose any pre-existing medical conditions. I understand that I should seek medical advice before starting any exercise program. The fitness centre is not responsible for any health complications arising due to undisclosed conditions.' },
  { title: 'Code of Conduct & Right of Admission', body: 'Management reserves the right of admission and may terminate membership without refund for: abusive, threatening, or inappropriate behavior; misuse of equipment (including dropping weights negligently); or violation of gym rules or safety guidelines.' },
  { title: 'Membership Usage & Access Control', body: 'Membership allows one entry per day, unless otherwise specified. Sharing membership credentials (ID card, biometrics, etc.) is strictly prohibited. Any misuse will result in immediate termination without refund.' },
  { title: 'Fees, Taxes & Payment Policy', body: 'All membership fees are non-refundable and non-transferable under any circumstances, including non-usage, relocation, or change of mind. Applicable taxes, including 5% GST, will be charged additionally. Prices and tax rates are subject to change as per government regulations.' },
  { title: 'Membership Freeze / Pause', body: 'Membership freezing may be allowed only with prior written request, subject to management approval, and applicable fees and conditions.' },
  { title: 'Personal Training Policy', body: 'Members are strictly prohibited from offering personal training services or receiving unofficial ("under-the-table") training. All training must be booked through authorized gym channels.' },
  { title: 'Equipment Use & Property Damage', body: 'Members must use equipment responsibly and follow staff instructions. Any damage caused due to negligence or misuse must be compensated fully by the member.' },
  { title: 'Personal Belongings & Locker Use', body: 'Lockers are provided for temporary use only. All belongings are kept at the member\u2019s own risk. The fitness centre is not liable for any loss, theft, or damage.' },
  { title: 'Supplements & External Products', body: 'The fitness centre does not endorse or take responsibility for any supplements or products purchased from third parties. Members consume such products at their own risk.' },
  { title: 'CCTV Surveillance & Privacy', body: 'The premises are under CCTV surveillance for safety and security. Recorded footage may be accessed only by management. Requests for footage retrieval and masking, if approved, will incur an administrative fee of \u20B9200.' },
  { title: 'Data Protection & Consent', body: 'By enrolling, I consent to the collection and use of my personal data for membership management and communication and updates. Data will be handled in accordance with applicable privacy laws.' },
  { title: 'Emergency Medical Consent', body: 'In case of an emergency, I authorize the fitness centre staff to arrange medical assistance. All associated costs shall be borne by me.' },
  { title: 'Indemnity Clause', body: 'I agree to indemnify and hold harmless the fitness centre, its staff, and affiliates from any claims, damages, or liabilities arising out of my use of the facility.' },
  { title: 'Rules & Amendments', body: 'Management reserves the right to modify rules, timings, fees, and policies at any time. Members are expected to stay informed and comply with updated terms.' },
  { title: 'Dispute Resolution & Jurisdiction', body: 'Any disputes arising shall be subject to the jurisdiction of courts in the city where the fitness centre is located.' },
];

const MEMBER_DECLARATION = 'I have read, understood, and agree to abide by all the terms and conditions stated above.';

export function MemberRegistrationFormDrawer({ open, onOpenChange, data }: MemberRegistrationFormProps) {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [govIdType, setGovIdType] = useState(data.governmentIdType || 'aadhaar');
  const [govIdNumber, setGovIdNumber] = useState(data.governmentIdNumber || '');
  const [fitnessGoals, setFitnessGoals] = useState(data.fitnessGoals || '');
  const [medicalConditions, setMedicalConditions] = useState(data.medicalConditions || '');
  const [healthChips, setHealthChips] = useState<string[]>(() => parseHealthConditions(data.medicalConditions).selected);
  const [healthOther, setHealthOther] = useState<string>(() => parseHealthConditions(data.medicalConditions).other);
  const [showMoreGoals, setShowMoreGoals] = useState(false);
  const [parq, setParq] = useState<Record<string, 'yes' | 'no'>>({});
  const [customTerms, setCustomTerms] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-sync prefilled values when drawer opens or member changes
  useEffect(() => {
    if (!open) return;
    setGovIdType(data.governmentIdType || 'aadhaar');
    setGovIdNumber(data.governmentIdNumber || '');
    setFitnessGoals(data.fitnessGoals || '');
    setMedicalConditions(data.medicalConditions || '');
    const parsed = parseHealthConditions(data.medicalConditions);
    setHealthChips(parsed.selected);
    setHealthOther(parsed.other);
  }, [open, data.memberId, data.governmentIdType, data.governmentIdNumber, data.fitnessGoals, data.medicalConditions]);

  // Load PAR-Q from member_onboarding_signatures (if member registered via /register)
  useEffect(() => {
    if (!open || !data.memberId) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from('member_onboarding_signatures')
        .select('par_q')
        .eq('member_id', data.memberId!)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !row?.par_q || typeof row.par_q !== 'object') return;
      const map: Record<string, 'yes' | 'no'> = {};
      const src = row.par_q as Record<string, string>;
      PARQ_QUESTIONS.forEach((q, i) => {
        const v = src[q] ?? src[`q${i}`];
        if (v === 'yes' || v === 'no') map[`q${i}`] = v;
      });
      setParq(map);
    })();
    return () => { cancelled = true; };
  }, [open, data.memberId]);

  // Keep medicalConditions string in sync with chips for PDF/print
  useEffect(() => {
    setMedicalConditions(joinHealthConditions(healthChips, healthOther));
  }, [healthChips, healthOther]);

  // Setup canvas for signature
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }, 100);
    return () => clearTimeout(timer);
  }, [open]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }, []);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSigned(true);
  }, [isDrawing, getPos]);

  const stopDraw = useCallback(() => setIsDrawing(false), []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleSaveDigital = async () => {
    if (!hasSigned) {
      toast.error('Please sign the form first');
      return;
    }
    if (!data.memberId) {
      toast.error('Member ID missing');
      return;
    }

    setSaving(true);
    try {
      const { data: existingRegistrationForm, error: existingError } = await supabase
        .from('member_documents')
        .select('id')
        .eq('member_id', data.memberId)
        .eq('document_type', 'registration_form')
        .maybeSingle();

      if (existingError) throw existingError;
      if (existingRegistrationForm) {
        throw new Error('Registration form already uploaded for this member');
      }

      // Get signature dataURL
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not found');
      const signatureDataUrl = canvas.toDataURL('image/png');

      // Snapshot PAR-Q answers (default unanswered → 'no' for storage parity with public flow)
      const parqMap: Record<string, string> = {};
      PARQ_QUESTIONS.forEach((q, i) => { parqMap[q] = parq[`q${i}`] || 'no'; });

      // Build full registration form PDF (form fields + signature)
      const pdfBlob = buildRegistrationFormPdf({
        data,
        govIdType,
        govIdNumber,
        fitnessGoals,
        medicalConditions,
        parq: parqMap,
        customTerms,
        terms: DEFAULT_TERMS,
        signatureDataUrl,
      });

      const fileName = `${data.memberId}/registration-form-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, pdfBlob, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      // Save document record
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from('member_documents').insert({
        member_id: data.memberId,
        document_type: 'registration_form',
        file_url: '',
        storage_path: fileName,
        file_name: `Registration-${data.memberCode}-signed.pdf`,
        uploaded_by: user?.id,
      });
      if (insertError) throw insertError;

      // Sync edits back to canonical records (best-effort, non-blocking)
      try {
        const memberUpdates: Record<string, string> = {};
        if (fitnessGoals && fitnessGoals !== (data.fitnessGoals || '')) memberUpdates.fitness_goals = fitnessGoals;
        if (medicalConditions && medicalConditions !== (data.medicalConditions || '')) memberUpdates.health_conditions = medicalConditions;
        if (Object.keys(memberUpdates).length) {
          await supabase.from('members').update(memberUpdates).eq('id', data.memberId);
        }
        const profileUpdates: Record<string, string> = {};
        if (govIdType && govIdType !== (data.governmentIdType || 'aadhaar')) profileUpdates.government_id_type = govIdType;
        if (govIdNumber && govIdNumber !== (data.governmentIdNumber || '')) profileUpdates.government_id_number = govIdNumber;
        if (Object.keys(profileUpdates).length) {
          const { data: m } = await supabase.from('members').select('user_id').eq('id', data.memberId).maybeSingle();
          if (m?.user_id) await (supabase.from('profiles') as any).update(profileUpdates).eq('user_id', m.user_id);
        }
        // Persist PAR-Q answers (insert a manual snapshot row)
        try {
          await supabase.from('member_onboarding_signatures').insert({
            member_id: data.memberId,
            signature_path: fileName,
            waiver_pdf_path: fileName,
            par_q: parqMap,
            consents: { waiver: true, source: 'staff_registration_form' },
            signed_at: new Date().toISOString(),
          });
        } catch (parqErr) {
          console.warn('[RegistrationForm] par_q snapshot failed', parqErr);
        }
      } catch (syncErr) {
        console.warn('[RegistrationForm] profile sync failed', syncErr);
      }

      toast.success('Registration form saved digitally with signature!');
      queryClient.invalidateQueries({ queryKey: ['member-documents', data.memberId] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Please allow popups'); return; }

    const signatureDataUrl = hasSigned ? canvasRef.current?.toDataURL('image/png') : null;

    const html = `<!DOCTYPE html><html><head><title>Membership Registration - ${e(data.memberName)}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; max-width: 800px; margin: 0 auto; font-size: 13px; }
      .header { text-align: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 3px double #6366f1; }
      .header h1 { color: #6366f1; font-size: 22px; text-transform: uppercase; letter-spacing: 3px; }
      .header p { color: #64748b; font-size: 11px; margin-top: 4px; }
      .badge { display: inline-block; background: #6366f1; color: white; padding: 2px 10px; border-radius: 10px; font-size: 10px; margin-top: 4px; }
      .title { font-size: 16px; font-weight: bold; text-align: center; margin: 16px 0; color: #334155; }
      .section { margin-bottom: 16px; }
      .section-title { font-size: 12px; font-weight: bold; color: #6366f1; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
      .field label { font-weight: 600; display: block; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
      .field .val { padding: 4px 0; border-bottom: 1px dotted #cbd5e1; min-height: 22px; font-size: 13px; }
      .full { grid-column: span 2; }
      .terms { background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin: 16px 0; }
      .terms ol { margin-left: 16px; }
      .terms li { margin-bottom: 4px; font-size: 11px; line-height: 1.4; }
      .sig-section { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
      .sig-box { text-align: center; }
      .sig-img { max-height: 60px; margin: 0 auto; }
      .sig-line { border-top: 1px solid #334155; margin-top: 40px; padding-top: 6px; font-size: 11px; color: #64748b; }
      .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      @media print { body { padding: 15px; } }
    </style></head><body>
      <div class="header">
        <h1>${e(data.branchName || 'FITNESS CENTER')}</h1>
        <p>Membership Registration & Agreement Form</p>
        <div class="badge">REG-${e(data.memberCode)}</div>
      </div>
      <div class="title">MEMBERSHIP AGREEMENT</div>
      <div class="section">
        <div class="section-title">👤 Member Information</div>
        <div class="grid">
          <div class="field"><label>Full Name</label><div class="val">${e(data.memberName)}</div></div>
          <div class="field"><label>Member Code</label><div class="val">${e(data.memberCode)}</div></div>
          <div class="field"><label>Email</label><div class="val">${e(data.email || '—')}</div></div>
          <div class="field"><label>Phone</label><div class="val">${e(data.phone || '—')}</div></div>
          <div class="field"><label>Gender</label><div class="val">${e(data.gender || '—')}</div></div>
          <div class="field"><label>Date of Birth</label><div class="val">${data.dateOfBirth ? format(new Date(data.dateOfBirth), 'dd MMM yyyy') : '—'}</div></div>
          <div class="field full"><label>Address</label><div class="val">${e([data.address, data.city, data.state].filter(Boolean).join(', ') || '—')}</div></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">🪪 Government ID</div>
        <div class="grid">
          <div class="field"><label>ID Type</label><div class="val">${e(govIdType.toUpperCase())}</div></div>
          <div class="field"><label>ID Number</label><div class="val">${e(govIdNumber || '—')}</div></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">🚨 Emergency Contact</div>
        <div class="grid">
          <div class="field"><label>Name</label><div class="val">${e(data.emergencyContactName || '—')}</div></div>
          <div class="field"><label>Phone</label><div class="val">${e(data.emergencyContactPhone || '—')}</div></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">💪 Health & Fitness</div>
        <div class="grid">
          <div class="field full"><label>Fitness Goals</label><div class="val">${e(fitnessGoals || '—')}</div></div>
          <div class="field full"><label>Medical Conditions</label><div class="val">${e(medicalConditions || 'None declared')}</div></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">📋 Membership Details</div>
        <div class="grid">
          <div class="field"><label>Plan</label><div class="val">${e(data.planName || '—')}</div></div>
          <div class="field"><label>Amount</label><div class="val">${data.pricePaid ? '₹' + data.pricePaid.toLocaleString('en-IN') : '—'}</div></div>
          <div class="field"><label>Start Date</label><div class="val">${data.startDate ? format(new Date(data.startDate), 'dd MMM yyyy') : '—'}</div></div>
          <div class="field"><label>End Date</label><div class="val">${data.endDate ? format(new Date(data.endDate), 'dd MMM yyyy') : '—'}</div></div>
          <div class="field"><label>Registration Date</label><div class="val">${format(new Date(), 'dd MMM yyyy')}</div></div>
          <div class="field"><label>Branch</label><div class="val">${e(data.branchName || '—')}</div></div>
        </div>
      </div>
      <div class="terms">
        <div class="section-title" style="color:#334155;">📜 Terms & Conditions</div>
        <ol>${DEFAULT_TERMS.map(t => `<li style="margin-bottom:6px"><strong>${e(t.title)}</strong><br/><span>${e(t.body)}</span></li>`).join('')}${customTerms ? `<li style="margin-bottom:6px"><strong>Custom Terms</strong><br/><span>${e(customTerms)}</span></li>` : ''}</ol>
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:11px;color:#334155"><strong>Member Declaration:</strong> ${e(MEMBER_DECLARATION)}</div>
      </div>
      <div class="sig-section">
        <div class="sig-box">
          ${signatureDataUrl ? `<img src="${signatureDataUrl}" class="sig-img" />` : ''}
          <div class="sig-line">Member Signature<br/><small>Date: ${format(new Date(), 'dd/MM/yyyy')}</small></div>
        </div>
        <div class="sig-box">
          <div class="sig-line">Authorized Staff Signature<br/><small>Date: _______________</small></div>
        </div>
      </div>
      <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString('en-IN')} • REF: ${e(data.memberCode)} • This is a computer-generated document</p>
      </div>
    </body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Membership Registration Form
          </SheetTitle>
          <SheetDescription>
            Complete the form below and collect the member's digital signature
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Member Info Summary */}
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground text-xs block">Name</span><span className="font-medium">{data.memberName}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Code</span><span className="font-medium">{data.memberCode}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Email</span><span>{data.email || '—'}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Phone</span><span>{data.phone || '—'}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Membership Details */}
          {data.planName && (
            <Card className="border-success/20 bg-success/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-success" />
                  <span className="font-semibold text-sm">Membership Details</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground text-xs block">Plan</span><Badge variant="secondary">{data.planName}</Badge></div>
                  <div><span className="text-muted-foreground text-xs block">Amount</span><span className="font-bold">₹{data.pricePaid?.toLocaleString('en-IN')}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Start</span><span>{data.startDate ? format(new Date(data.startDate), 'dd MMM yyyy') : '—'}</span></div>
                  <div><span className="text-muted-foreground text-xs block">End</span><span>{data.endDate ? format(new Date(data.endDate), 'dd MMM yyyy') : '—'}</span></div>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Government ID */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-primary" />
              <Label className="font-semibold">Government ID</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">ID Type</Label>
                <Select value={govIdType} onValueChange={setGovIdType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                    <SelectItem value="pan">PAN Card</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="voter_id">Voter ID</SelectItem>
                    <SelectItem value="driving_license">Driving License</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ID Number</Label>
                <Input value={govIdNumber} onChange={e => setGovIdNumber(e.target.value)} placeholder="Enter ID number" />
              </div>
            </div>
          </div>

          {/* Fitness Goals & Medical */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="h-4 w-4 text-primary" />
              <Label className="font-semibold">Health & Fitness</Label>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fitness Goals</Label>
                <Textarea value={fitnessGoals} onChange={e => setFitnessGoals(e.target.value)}
                  placeholder="e.g. Weight loss, muscle gain, general fitness, flexibility improvement"
                  className="min-h-[60px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Medical Conditions / Injuries (if any)</Label>
                <Textarea value={medicalConditions} onChange={e => setMedicalConditions(e.target.value)}
                  placeholder="e.g. Back pain, knee injury, diabetes, heart condition — or leave blank"
                  className="min-h-[60px]" />
              </div>
            </div>
          </div>

          {/* Custom T&C */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Dumbbell className="h-4 w-4 text-primary" />
              <Label className="font-semibold">Custom Terms (Optional)</Label>
            </div>
            <Textarea value={customTerms} onChange={e => setCustomTerms(e.target.value)}
              placeholder="Add any custom terms or conditions specific to this member..."
              className="min-h-[50px]" />
            <p className="text-xs text-muted-foreground mt-1">All {DEFAULT_TERMS.length} standard membership terms &amp; conditions are included automatically. Use the field above only for member-specific addendums.</p>
          </div>

          <Separator />

          {/* Digital Signature */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-primary" />
                <Label className="font-semibold">Digital Signature</Label>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSignature} className="text-xs">
                <Eraser className="h-3 w-3 mr-1" /> Clear
              </Button>
            </div>
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl bg-muted/30 relative">
              <canvas
                ref={canvasRef}
                className="w-full h-[140px] cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
              {!hasSigned && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-muted-foreground/50 text-sm">Sign here ✍️</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Draw your signature above using mouse or touch. This will be saved digitally.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 pb-4">
            <Button variant="outline" className="flex-1" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <Button className="flex-1" onClick={handleSaveDigital} disabled={saving || !hasSigned}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Digital Copy'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface BuildPdfArgs {
  data: RegistrationFormData;
  govIdType: string;
  govIdNumber: string;
  fitnessGoals: string;
  medicalConditions: string;
  parq?: Record<string, string>;
  customTerms: string;
  terms: TermClause[];
  signatureDataUrl?: string | null;
}

function buildRegistrationFormPdf(args: BuildPdfArgs): Blob {
  const { data, govIdType, govIdNumber, fitnessGoals, medicalConditions, parq, customTerms, terms, signatureDataUrl } = args;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;

  // Header band
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(99, 102, 241);
  doc.text((data.branchName || 'FITNESS CENTER').toUpperCase(), margin, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Membership Registration & Agreement Form', margin, 28);

  doc.setFontSize(9);
  doc.text(`REG-${data.memberCode}`, pageW - margin, 22, { align: 'right' });
  doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, pageW - margin, 28, { align: 'right' });

  let y = 38;

  const section = (title: string) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, pageW - margin * 2, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(99, 102, 241);
    doc.text(title.toUpperCase(), margin + 2, y + 4.2);
    y += 8;
  };

  const fieldsTable = (rows: Array<[string, string]>) => {
    autoTable(doc, {
      startY: y,
      body: rows.map(([k, v]) => [k, v || '—']),
      theme: 'plain',
      bodyStyles: { fontSize: 9, textColor: [30, 41, 59], cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 } },
      columnStyles: { 0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 45 } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  };

  section('Member Information');
  fieldsTable([
    ['Full Name', data.memberName],
    ['Member Code', data.memberCode],
    ['Email', data.email || ''],
    ['Phone', data.phone || ''],
    ['Gender', data.gender || ''],
    ['Date of Birth', data.dateOfBirth ? format(new Date(data.dateOfBirth), 'dd MMM yyyy') : ''],
    ['Address', [data.address, data.city, data.state].filter(Boolean).join(', ')],
  ]);

  section('Government ID');
  fieldsTable([
    ['ID Type', govIdType.toUpperCase()],
    ['ID Number', govIdNumber],
  ]);

  section('Emergency Contact');
  fieldsTable([
    ['Name', data.emergencyContactName || ''],
    ['Phone', data.emergencyContactPhone || ''],
  ]);

  section('Health & Fitness');
  fieldsTable([
    ['Fitness Goals', fitnessGoals],
    ['Medical Conditions', medicalConditions || 'None declared'],
  ]);

  if (parq && Object.keys(parq).length) {
    section('PAR-Q Health Screen');
    autoTable(doc, {
      startY: y,
      head: [['#', 'Question', 'Answer']],
      body: PARQ_QUESTIONS.map((q, i) => [String(i + 1), q, (parq[q] || 'no').toUpperCase()]),
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241], fontSize: 8.5, textColor: 255 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  section('Membership Details');
  fieldsTable([
    ['Plan', data.planName || ''],
    ['Amount', data.pricePaid ? `Rs. ${data.pricePaid.toLocaleString('en-IN')}` : ''],
    ['Start Date', data.startDate ? format(new Date(data.startDate), 'dd MMM yyyy') : ''],
    ['End Date', data.endDate ? format(new Date(data.endDate), 'dd MMM yyyy') : ''],
    ['Branch', data.branchName || ''],
  ]);

  // Terms
  section('Terms & Conditions');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const allTerms: TermClause[] = customTerms
    ? [...terms, { title: 'Custom Terms', body: customTerms }]
    : terms;
  const lineH = 3.4;
  allTerms.forEach((t, i) => {
    const titleStr = `${i + 1}. ${t.title}`;
    const bodyLines = doc.splitTextToSize(t.body, pageW - margin * 2 - 4);
    const blockH = lineH + bodyLines.length * lineH + 2;
    if (y + blockH > pageH - 60) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(51, 65, 85);
    doc.text(titleStr, margin + 2, y);
    y += lineH;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    doc.setTextColor(30, 41, 59);
    doc.text(bodyLines, margin + 4, y);
    y += bodyLines.length * lineH + 2;
  });

  // Member Declaration
  if (y + 16 > pageH - 60) { doc.addPage(); y = 20; }
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(99, 102, 241);
  doc.text('MEMBER DECLARATION', margin + 2, y);
  y += lineH + 1;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const decl = doc.splitTextToSize(MEMBER_DECLARATION, pageW - margin * 2 - 4);
  doc.text(decl, margin + 2, y);
  y += decl.length * lineH + 2;

  // Signature section
  if (y > pageH - 55) {
    doc.addPage();
    y = 20;
  }
  y += 8;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const sigBoxW = (pageW - margin * 2 - 10) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('MEMBER SIGNATURE', margin, y);
  doc.text('AUTHORIZED STAFF', margin + sigBoxW + 10, y);
  y += 3;

  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', margin, y, sigBoxW, 22);
    } catch {
      // ignore
    }
  }

  const sigLineY = y + 26;
  doc.setDrawColor(30, 41, 59);
  doc.line(margin, sigLineY, margin + sigBoxW, sigLineY);
  doc.line(margin + sigBoxW + 10, sigLineY, pageW - margin, sigLineY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.memberName} • ${format(new Date(), 'dd/MM/yyyy')}`, margin, sigLineY + 4);
  doc.text('Date: ____________________', margin + sigBoxW + 10, sigLineY + 4);

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated ${new Date().toLocaleString('en-IN')}  •  REF: ${data.memberCode}  •  The Incline Life by Incline`,
    pageW / 2,
    pageH - 8,
    { align: 'center' },
  );

  return doc.output('blob');
}

// Keep legacy export for backward compat
export function printRegistrationForm(data: RegistrationFormData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Please allow popups to print'); return; }

  const html = `<!DOCTYPE html><html><head><title>Membership Registration - ${e(data.memberName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 3px double #6366f1; }
    .header h1 { color: #6366f1; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
    .header p { color: #666; font-size: 12px; margin-top: 5px; }
    .title { font-size: 18px; font-weight: bold; text-align: center; margin: 20px 0; text-decoration: underline; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: bold; color: #6366f1; margin-bottom: 10px; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item { font-size: 13px; }
    .info-item label { font-weight: 600; display: block; margin-bottom: 2px; color: #555; }
    .info-item .value { padding: 6px 0; border-bottom: 1px dotted #ccc; min-height: 28px; }
    .terms { background: #f9f9f9; padding: 15px; border: 1px solid #ddd; margin: 20px 0; font-size: 12px; }
    .terms ol { margin-left: 18px; }
    .terms li { margin-bottom: 6px; }
    .signature-section { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .signature-box { text-align: center; }
    .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 8px; font-size: 12px; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
    @media print { body { padding: 20px; } }
  </style></head><body>
    <div class="header"><h1>${e(data.branchName || 'FITNESS CENTER')}</h1><p>Membership Registration Form</p></div>
    <div class="title">MEMBERSHIP AGREEMENT</div>
    <div class="section"><div class="section-title">Member Details</div>
      <div class="info-grid">
        <div class="info-item"><label>Full Name</label><div class="value">${e(data.memberName)}</div></div>
        <div class="info-item"><label>Member Code</label><div class="value">${e(data.memberCode)}</div></div>
        <div class="info-item"><label>Email</label><div class="value">${e(data.email || '___')}</div></div>
        <div class="info-item"><label>Phone</label><div class="value">${e(data.phone || '___')}</div></div>
        <div class="info-item"><label>Gender</label><div class="value">${e(data.gender || '___')}</div></div>
        <div class="info-item"><label>Date of Birth</label><div class="value">${data.dateOfBirth ? format(new Date(data.dateOfBirth), 'dd MMM yyyy') : '___'}</div></div>
        <div class="info-item" style="grid-column:span 2"><label>Address</label><div class="value">${e(data.address || '___')}</div></div>
      </div></div>
    <div class="section"><div class="section-title">Emergency Contact</div>
      <div class="info-grid">
        <div class="info-item"><label>Name</label><div class="value">${e(data.emergencyContactName || '___')}</div></div>
        <div class="info-item"><label>Phone</label><div class="value">${e(data.emergencyContactPhone || '___')}</div></div>
      </div></div>
    <div class="section"><div class="section-title">Membership Details</div>
      <div class="info-grid">
        <div class="info-item"><label>Plan</label><div class="value">${e(data.planName || '___')}</div></div>
        <div class="info-item"><label>Amount</label><div class="value">${data.pricePaid ? '₹' + data.pricePaid.toLocaleString('en-IN') : '___'}</div></div>
        <div class="info-item"><label>Start Date</label><div class="value">${data.startDate ? format(new Date(data.startDate), 'dd MMM yyyy') : '___'}</div></div>
        <div class="info-item"><label>End Date</label><div class="value">${data.endDate ? format(new Date(data.endDate), 'dd MMM yyyy') : '___'}</div></div>
      </div></div>
    <div class="terms"><div class="section-title" style="color:#333">Terms & Conditions</div>
      <ol>${DEFAULT_TERMS.map(t => `<li style="margin-bottom:6px"><strong>${e(t.title)}</strong><br/><span>${e(t.body)}</span></li>`).join('')}</ol>
      <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #ccc;font-size:11px"><strong>Member Declaration:</strong> ${e(MEMBER_DECLARATION)}</div></div>
    <div class="signature-section">
      <div class="signature-box"><div class="signature-line">Member Signature<br/><small>Date: ___</small></div></div>
      <div class="signature-box"><div class="signature-line">Staff Signature<br/><small>Date: ___</small></div></div>
    </div>
    <div class="footer"><p>Generated on ${new Date().toLocaleDateString('en-IN')}</p></div>
  </body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => printWindow.print();
}
