import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkOrderTemplateService } from '../../core/services/work-order-template.service';
import {
  RecurringMaintenanceRuleRequest,
  RecurringMaintenanceRuleResponse,
  WorkOrderTemplateRequest,
  WorkOrderTemplateResponse,
} from '../../core/models/sentinel.models';

@Component({
  selector: 'app-work-order-templates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './work-order-templates.component.html',
  styleUrl: './work-order-templates.component.scss',
})
export class WorkOrderTemplatesComponent implements OnInit {
  tab: 'templates' | 'recurring' = 'templates';

  templates: WorkOrderTemplateResponse[] = [];
  isLoadingTemplates = true;
  showTemplateForm = false;
  editingTemplateId: number | null = null;
  templateForm: WorkOrderTemplateRequest = this.emptyTemplateForm();
  isSavingTemplate = false;

  readonly types: Array<'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY'> = ['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY'];
  readonly priorities: Array<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  lookupMachineId: number | null = null;
  rules: RecurringMaintenanceRuleResponse[] = [];
  isLoadingRules = false;
  ruleForm: RecurringMaintenanceRuleRequest = this.emptyRuleForm();
  isSavingRule = false;
  ruleError: string | null = null;

  constructor(private templateService: WorkOrderTemplateService) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  setTab(tab: 'templates' | 'recurring'): void {
    this.tab = tab;
  }

  private emptyTemplateForm(): WorkOrderTemplateRequest {
    return { name: '', description: '', type: 'PREVENTIVE', priority: 'MEDIUM', estimatedDuration: undefined, defaultNotes: '', active: true };
  }

  private emptyRuleForm(): RecurringMaintenanceRuleRequest {
    return { machineId: 0, workOrderTemplateId: 0, intervalDays: 90, assignedTechnicianId: undefined, firstRunDate: '' };
  }

  loadTemplates(): void {
    this.isLoadingTemplates = true;
    this.templateService.getTemplates(false).subscribe({
      next: (templates) => { this.templates = templates; this.isLoadingTemplates = false; },
      error: () => { this.isLoadingTemplates = false; },
    });
  }

  openCreateTemplate(): void {
    this.editingTemplateId = null;
    this.templateForm = this.emptyTemplateForm();
    this.showTemplateForm = true;
  }

  openEditTemplate(template: WorkOrderTemplateResponse): void {
    this.editingTemplateId = template.id;
    this.templateForm = {
      name: template.name,
      description: template.description,
      type: template.type,
      priority: template.priority,
      estimatedDuration: template.estimatedDuration,
      defaultNotes: template.defaultNotes,
      active: template.active,
    };
    this.showTemplateForm = true;
  }

  cancelTemplateForm(): void {
    this.showTemplateForm = false;
    this.editingTemplateId = null;
  }

  saveTemplate(): void {
    if (!this.templateForm.name.trim()) return;
    this.isSavingTemplate = true;
    const op = this.editingTemplateId != null
      ? this.templateService.updateTemplate(this.editingTemplateId, this.templateForm)
      : this.templateService.createTemplate(this.templateForm);
    op.subscribe({
      next: () => { this.isSavingTemplate = false; this.cancelTemplateForm(); this.loadTemplates(); },
      error: () => { this.isSavingTemplate = false; },
    });
  }

  deactivateTemplate(template: WorkOrderTemplateResponse): void {
    if (!confirm(`Deactivate template "${template.name}"?`)) return;
    this.templateService.deactivateTemplate(template.id).subscribe({ next: () => this.loadTemplates() });
  }

  lookupRules(): void {
    if (this.lookupMachineId == null) return;
    this.isLoadingRules = true;
    this.templateService.getRulesByMachine(this.lookupMachineId).subscribe({
      next: (rules) => { this.rules = rules; this.isLoadingRules = false; },
      error: () => { this.rules = []; this.isLoadingRules = false; },
    });
  }

  createRule(): void {
    if (!this.ruleForm.machineId || !this.ruleForm.workOrderTemplateId || !this.ruleForm.intervalDays) return;
    this.isSavingRule = true;
    this.ruleError = null;
    const request: RecurringMaintenanceRuleRequest = {
      ...this.ruleForm,
      firstRunDate: this.ruleForm.firstRunDate || undefined,
    };
    this.templateService.createRule(request).subscribe({
      next: () => {
        this.isSavingRule = false;
        this.lookupMachineId = this.ruleForm.machineId;
        this.ruleForm = this.emptyRuleForm();
        this.lookupRules();
      },
      error: () => { this.isSavingRule = false; this.ruleError = 'Could not create rule — check the machine and template IDs.'; },
    });
  }

  deactivateRule(rule: RecurringMaintenanceRuleResponse): void {
    if (!confirm('Stop this recurring maintenance rule?')) return;
    this.templateService.deactivateRule(rule.id).subscribe({ next: () => this.lookupRules() });
  }
}
