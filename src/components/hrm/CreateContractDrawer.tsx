import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContract } from '@/services/hrmService';
import { toast } from 'sonner';
import { FileText, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type AgreementRole = 'trainer' | 'staff' | 'manager';

type EmployeePrefill = {
  employeeCode?: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
};

function formatExecutionDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function detectAgreementRole(employee: any): AgreementRole {
  if (employee?.staff_type === 'trainer') return 'trainer';

  const position = String(employee?.position || '').toLowerCase();
  const department = String(employee?.department || '').toLowerCase();
  if (position.includes('manager') || department.includes('management')) {
    return 'manager';
  }

  return 'staff';
}

function getEmploymentAgreementTemplate(
  role: AgreementRole,
  employeeName: string,
  salary: number,
  startDate: string,
  prefill?: EmployeePrefill,
) {
  const trainerChecked = role === 'trainer' ? 'x' : ' ';
  const staffChecked = role === 'staff' ? 'x' : ' ';
  const managerChecked = role === 'manager' ? 'x' : ' ';
  const fixedSalary = Number.isFinite(salary) && salary > 0 ? Math.round(salary).toLocaleString('en-IN') : '________';
  const executionDate = formatExecutionDate(startDate);
  const companyAddress = 'Udaipur, Rajasthan';
  const employeeCode = prefill?.employeeCode || '-';
  const email = prefill?.email || '-';
  const phone = prefill?.phone || '-';
  const position = prefill?.position || (role === 'trainer' ? 'Trainer' : role === 'manager' ? 'Manager' : 'Staff');
  const department = prefill?.department || (role === 'trainer' ? 'Training' : role === 'manager' ? 'Management' : 'Operations');

  return `# EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is executed on ${executionDate} at Udaipur, Rajasthan.

## BETWEEN

Incline (Proprietorship Firm)
Owned and operated by Ms. Yogita Lekhari,
Having its principal place of business at: ${companyAddress}
(hereinafter referred to as the "Employer" or "Company")

## AND

Mr./Ms. ${employeeName || '__________________________'},
Employee Code: ${employeeCode}
Email: ${email}
Phone: ${phone}
Position: ${position}
Department: ${department}
S/o / D/o __________________________,
Residing at: ___________________________
(hereinafter referred to as the "Employee")

---

## 1. APPOINTMENT

The Employee is hereby appointed as:

[${trainerChecked}] Fitness Trainer
[${staffChecked}] Sales Executive
[${managerChecked}] Manager

The Employee agrees to faithfully perform duties assigned by the Employer.

---

## 2. COMMENCEMENT & NATURE OF EMPLOYMENT

* Employment start date: ${startDate || '**/**/20__'}
* This is a private employment contract governed by mutually agreed terms.
* This does not create permanent employment unless specified.

---

## 3. JOB RESPONSIBILITIES

### A. FITNESS TRAINER

* Conduct personal training sessions
* Maintain client progress records
* Ensure safety and hygiene
* Promote personal training packages

### B. SALES STAFF

* Handle walk-ins, conversions, and follow-ups
* Achieve monthly sales targets
* Maintain CRM / lead data confidentiality

### C. MANAGER

* Oversee operations, staff, and revenue
* Ensure discipline and service quality
* Report directly to Proprietor

---

## 4. WORKING HOURS

* As per shift assigned by Employer
* Employer reserves full right to change shifts and weekly offs

---

## 5. SALARY & COMPENSATION

* Fixed Salary: Rs. ${fixedSalary} per month
* Payment cycle: Monthly

### PERSONAL TRAINING (PT) COMMISSION - APPLICABLE TO TRAINERS

* Commission shall be paid on Personal Training revenue (pre-GST amount only)
* Commission %: _______%
* Paid only after full payment is received from client

---

## 6. LEAVE & ABSENTEEISM

* Leaves must be pre-approved
* Any unapproved leave shall result in full salary deduction (pro-rata basis)
* Excess leaves beyond allowed limits shall be unpaid
* Continuous absence of 3 days without notice may be treated as abandonment

---

## 7. NOTICE PERIOD (EMPLOYEE EXIT)

* Employee must serve 90 (ninety) days mandatory notice period
* Failure will result in:
  * Salary deduction equivalent to notice period
  * Additional recovery for business loss (if applicable)

---

## 8. TERMINATION BY EMPLOYER

* Employer reserves absolute right to terminate employment at any time, with or without reason
* Termination may be:
  * Immediate, or
  * With notice/pay (at Employer's discretion)

---

## 9. CONFIDENTIALITY

Employee shall not disclose:

* Client database
* Pricing, offers, or strategy
* Business operations or internal matters

This clause survives termination.

---

## 10. NON-SOLICITATION (CRITICAL CLAUSE)

Employee agrees that during employment and for 12 months after leaving, they shall not:

* Contact or solicit any client of Incline
* Offer training/services to existing or past clients of Incline
* Induce any staff to leave

---

## 11. PENALTY CLAUSE (CLIENT POACHING & BREACH)

In case of breach of Clause 9 or 10:

* Employee shall be liable to pay:
  * Rs. 50,000 minimum penalty, OR
  * 3x value of client business lost, whichever is higher
* Employer reserves right to initiate legal recovery

---

## 12. MISCONDUCT

Immediate termination without notice in case of:

* Misbehavior with clients
* Theft, fraud, or dishonesty
* Sleeping on duty / negligence
* Harassment or indiscipline
* Unauthorized absence
* Working with competitors

---

## 13. DEDUCTIONS & RECOVERY

Employer has right to deduct from salary/final settlement:

* Notice period shortfall
* Client loss or damages
* Uniform / equipment cost
* Any financial loss caused

---

## 14. PF / ESI COMPLIANCE

* As per current salary structure (Rs. 10,000-Rs. 15,000 range):
  * PF applicability may not be mandatory unless opted
  * ESI applicability depends on eligibility thresholds
* If Employee becomes eligible under law:
  * PF/ESI shall be deducted as per statutory norms
  * Employer shall comply accordingly

---

## 15. NO COMPETITION DURING EMPLOYMENT

Employee shall not:

* Work in any other gym/fitness center
* Run personal training business independently
  Without written permission

---

## 16. GOVERNING LAW & JURISDICTION

* This Agreement is governed by laws of India
* Jurisdiction: Courts of Udaipur, Rajasthan

---

## 17. FINAL SETTLEMENT CONDITION

* Full & final settlement will be processed only after:
  * Clearance of dues
  * Return of company property
  * Completion of notice obligations

---

## 18. ACCEPTANCE

Employee confirms:

* They have read and understood all terms
* They agree voluntarily without coercion

---

## SIGNATURES

For Incline (Proprietor: Yogita Lekhari)
Signature: ____________________

Name: Yogita Lekhari

---

Employee
Signature: ____________________

Name: ${employeeName || '____________________'}

---

## WITNESSES

Witness 1
Name: ____________________
Signature: ____________________

Witness 2
Name: ____________________
Signature: ____________________

---

## ANNEXURE A (ROLE-SPECIFIC DETAILS)

(To be attached separately if needed)

* Salary Breakdown
* Commission Structure
* Incentive Plans
* Leave Policy Details

---`;
}

interface CreateContractDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any;
}

export function CreateContractDrawer({ open, onOpenChange, employee }: CreateContractDrawerProps) {
  const queryClient = useQueryClient();
  const { hasAnyRole, user, profile } = useAuth();
  const canEditLegalClauses = hasAnyRole(['owner', 'admin', 'manager']);
  const defaultRole = detectAgreementRole(employee);
  const defaultEmployeeName = employee?.profile?.full_name || employee?.full_name || '__________________________';
  const defaultStartDate = new Date().toISOString().split('T')[0];
  const defaultSalary = Number(employee?.salary || 0);
  const employeePrefill: EmployeePrefill = {
    employeeCode: employee?.employee_code,
    email: employee?.profile?.email,
    phone: employee?.profile?.phone,
    position: employee?.position,
    department: employee?.department,
  };

  const [formData, setFormData] = useState({
    agreementRole: defaultRole,
    contractType: 'full_time',
    startDate: defaultStartDate,
    endDate: '',
    salary: defaultSalary,
    commissionPercentage: 0,
    terms: getEmploymentAgreementTemplate(defaultRole, defaultEmployeeName, defaultSalary, defaultStartDate, employeePrefill),
    documentUrl: '',
  });
  const [legalTermsUnlocked, setLegalTermsUnlocked] = useState(false);
  const [legalTermsUnlockedAt, setLegalTermsUnlockedAt] = useState<string | null>(null);

  const logContractAudit = async (action: string, actionDescription: string, newData?: any) => {
    try {
      await supabase.from('audit_logs').insert({
        action,
        table_name: 'contracts',
        record_id: employee?.id || null,
        user_id: user?.id,
        actor_name: profile?.full_name || user?.email || 'Staff',
        branch_id: employee?.branch_id || null,
        action_description: actionDescription,
        new_data: newData,
      });
    } catch {
      // Best-effort audit; do not block the workflow.
    }
  };

  useEffect(() => {
    if (!open || !employee) return;

    const role = detectAgreementRole(employee);
    const employeeName = employee?.profile?.full_name || employee?.full_name || '__________________________';
    const startDate = new Date().toISOString().split('T')[0];
    const salary = Number(employee?.salary || 0);

    setFormData({
      agreementRole: role,
      contractType: 'full_time',
      startDate,
      endDate: '',
      salary,
      commissionPercentage: role === 'trainer' ? 10 : 0,
      terms: getEmploymentAgreementTemplate(role, employeeName, salary, startDate, {
        employeeCode: employee?.employee_code,
        email: employee?.profile?.email,
        phone: employee?.profile?.phone,
        position: employee?.position,
        department: employee?.department,
      }),
      documentUrl: '',
    });
    setLegalTermsUnlocked(false);
    setLegalTermsUnlockedAt(null);
  }, [open, employee]);

  const createContractMutation = useMutation({
    mutationFn: createContract,
    onSuccess: async (createdContract: any) => {
      await logContractAudit(
        'CONTRACT_CREATED',
        `Contract created for ${employee?.profile?.full_name || employee?.full_name || 'employee'} (${formData.agreementRole})`,
        {
          contract_id: createdContract?.id,
          agreement_role: formData.agreementRole,
          legal_terms_unlocked: legalTermsUnlocked,
          legal_terms_unlocked_at: legalTermsUnlockedAt,
          contract_type: formData.contractType,
        },
      );
      toast.success('Contract created successfully');
      queryClient.invalidateQueries({ queryKey: ['employee-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create contract: ' + error.message);
    },
  });

  const resetForm = () => {
    const role = detectAgreementRole(employee);
    const employeeName = employee?.profile?.full_name || employee?.full_name || '__________________________';
    const startDate = new Date().toISOString().split('T')[0];
    const salary = Number(employee?.salary || 0);

    setFormData({
      agreementRole: role,
      contractType: 'full_time',
      startDate,
      endDate: '',
      salary,
      commissionPercentage: role === 'trainer' ? 10 : 0,
      terms: getEmploymentAgreementTemplate(role, employeeName, salary, startDate, {
        employeeCode: employee?.employee_code,
        email: employee?.profile?.email,
        phone: employee?.profile?.phone,
        position: employee?.position,
        department: employee?.department,
      }),
      documentUrl: '',
    });
    setLegalTermsUnlocked(false);
    setLegalTermsUnlockedAt(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee?.id) return;

    // Check if this is a trainer (has staff_type = 'trainer') or regular employee
    const isTrainer = employee.staff_type === 'trainer';
    
    createContractMutation.mutate({
      employeeId: isTrainer ? undefined : employee.id,
      trainerId: isTrainer ? employee.id : undefined,
      contractType: formData.contractType,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      salary: Number(formData.salary),
      baseSalary: Number(formData.salary),
      commissionPercentage: Number(formData.commissionPercentage),
      terms: formData.terms ? {
        conditions: formData.terms,
        compliance_meta: {
          template_version: 'incline-employment-v1',
          agreement_role: formData.agreementRole,
          legal_terms_locked_by_default: true,
          legal_terms_unlocked: legalTermsUnlocked,
          legal_terms_unlocked_at: legalTermsUnlockedAt,
          legal_terms_unlocked_by: legalTermsUnlockedAt ? (user?.id || null) : null,
        },
      } : undefined,
      documentUrl: formData.documentUrl || undefined,
    });
  };

  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            Create Contract
          </SheetTitle>
          <SheetDescription>
            Create a new contract for {employee.profile?.full_name || 'Employee'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Employee Info */}
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="font-medium">{employee.profile?.full_name}</p>
            <p className="text-sm text-muted-foreground">{employee.employee_code}</p>
            <p className="text-sm text-muted-foreground">{employee.position || 'No position'}</p>
          </div>

          <div className="space-y-2">
            <Label>Agreement Role *</Label>
            <Select
              value={formData.agreementRole}
              onValueChange={(value: AgreementRole) => {
                const employeeName = employee?.profile?.full_name || employee?.full_name || '__________________________';
                setFormData({
                  ...formData,
                  agreementRole: value,
                  commissionPercentage: value === 'trainer' ? Math.max(formData.commissionPercentage, 10) : formData.commissionPercentage,
                  terms: getEmploymentAgreementTemplate(value, employeeName, formData.salary, formData.startDate, {
                    employeeCode: employee?.employee_code,
                    email: employee?.profile?.email,
                    phone: employee?.profile?.phone,
                    position: employee?.position,
                    department: employee?.department,
                  }),
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trainer">Trainer</SelectItem>
                <SelectItem value="staff">Staff (Sales/Front Desk)</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Selecting role auto-fills the contract template for trainer/staff/manager.</p>
          </div>

          <div className="space-y-2">
            <Label>Contract Type *</Label>
            <Select
              value={formData.contractType}
              onValueChange={(value) => setFormData({ ...formData, contractType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full Time</SelectItem>
                <SelectItem value="part_time">Part Time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
                <SelectItem value="probation">Probation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  const nextStartDate = e.target.value;
                  const employeeName = employee?.profile?.full_name || employee?.full_name || '__________________________';
                  setFormData({
                    ...formData,
                    startDate: nextStartDate,
                    terms: legalTermsUnlocked
                      ? formData.terms
                      : getEmploymentAgreementTemplate(formData.agreementRole, employeeName, formData.salary, nextStartDate, {
                        employeeCode: employee?.employee_code,
                        email: employee?.profile?.email,
                        phone: employee?.profile?.phone,
                        position: employee?.position,
                        department: employee?.department,
                      }),
                  });
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                placeholder="Leave empty for ongoing"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Salary (₹) *</Label>
              <Input
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Commission %</Label>
              <Input
                type="number"
                value={formData.commissionPercentage}
                onChange={(e) => setFormData({ ...formData, commissionPercentage: Number(e.target.value) })}
                min={0}
                max={100}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">PT session commission rate</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Terms & Conditions</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const employeeName = employee?.profile?.full_name || employee?.full_name || '__________________________';
                    setFormData({
                      ...formData,
                      terms: getEmploymentAgreementTemplate(formData.agreementRole, employeeName, formData.salary, formData.startDate, {
                        employeeCode: employee?.employee_code,
                        email: employee?.profile?.email,
                        phone: employee?.profile?.phone,
                        position: employee?.position,
                        department: employee?.department,
                      }),
                    });
                    setLegalTermsUnlocked(false);
                    setLegalTermsUnlockedAt(null);
                    await logContractAudit(
                      'CONTRACT_TERMS_TEMPLATE_RESET',
                      `Reset agreement template for ${employeeName}`,
                      { agreement_role: formData.agreementRole },
                    );
                    toast.success('Agreement reset to template');
                  }}
                >
                  Reset Template
                </Button>
                {canEditLegalClauses ? (
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Unlock Legal Clauses</Label>
                    <Switch
                      checked={legalTermsUnlocked}
                      onCheckedChange={async (checked) => {
                        if (!checked) {
                          setLegalTermsUnlocked(false);
                          return;
                        }

                        const unlockedAt = new Date().toISOString();
                        setLegalTermsUnlocked(true);
                        setLegalTermsUnlockedAt(unlockedAt);
                        await logContractAudit(
                          'CONTRACT_LEGAL_TERMS_UNLOCKED',
                          `Unlocked legal clauses for ${employee?.profile?.full_name || employee?.full_name || 'employee'}`,
                          { agreement_role: formData.agreementRole, unlocked_at: unlockedAt },
                        );
                      }}
                    />
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs">Locked: Admin/Owner/Manager only</Badge>
                )}
              </div>
            </div>
            <Textarea
              value={formData.terms}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              placeholder="Employment agreement terms..."
              rows={16}
              readOnly={!legalTermsUnlocked}
            />
            <p className="text-xs text-muted-foreground">
              Agreement is prefilled and legally locked by default. Only admin-level users can unlock and edit legal clauses.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Contract Document (Upload)</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.png"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fileName = `contracts/${employee?.id || 'unknown'}/${Date.now()}-${file.name}`;
                const { error } = await (await import('@/integrations/supabase/client')).supabase.storage
                  .from('documents')
                  .upload(fileName, file);
                if (error) {
                  (await import('sonner')).toast.error('Upload failed: ' + error.message);
                } else {
                  const { data: urlData } = (await import('@/integrations/supabase/client')).supabase.storage
                    .from('documents')
                    .getPublicUrl(fileName);
                  setFormData({ ...formData, documentUrl: urlData.publicUrl });
                  (await import('sonner')).toast.success('Document uploaded');
                }
              }}
            />
            {formData.documentUrl && (
              <a href={formData.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">
                View uploaded document
              </a>
            )}
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createContractMutation.isPending}>
              {createContractMutation.isPending ? 'Creating...' : 'Create Contract'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
