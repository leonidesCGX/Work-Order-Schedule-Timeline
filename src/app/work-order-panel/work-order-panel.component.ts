import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { WorkOrderService } from '../services/work-order.service';
import { WorkOrderDocument, WorkOrderStatus } from '../models/work-order.model';

@Component({
  selector: 'app-work-order-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgbDatepickerModule,
    NgSelectModule
  ],
  templateUrl: './work-order-panel.component.html',
  styleUrl: './work-order-panel.component.scss'
})
export class WorkOrderPanelComponent implements OnInit, OnChanges {
  @Input() isOpen: boolean = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() workCenterId: string = '';
  @Input() startDate: Date = new Date();
  @Input() endDate?: Date;
  @Input() workOrder: WorkOrderDocument | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<WorkOrderDocument>();

  workOrderForm!: FormGroup;
  overlapError: string = '';

  statusOptions: { value: WorkOrderStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'in-progress', label: 'In progress' },
    { value: 'complete', label: 'Complete' },
    { value: 'blocked', label: 'Blocked' }
  ];

  constructor(
    private fb: FormBuilder,
    private workOrderService: WorkOrderService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.resetForm();
      if (this.mode === 'edit' && this.workOrder) {
        this.populateForm(this.workOrder);
      } else if (this.mode === 'create') {
        this.setInitialDates();
      }
    }
    // Update dates if startDate or endDate changes while panel is open
    if ((changes['startDate'] || changes['endDate']) && this.isOpen && this.mode === 'create') {
      this.setInitialDates();
    }
  }

  private initForm(): void {
    this.workOrderForm = this.fb.group({
      name: ['', [Validators.required]],
      status: ['open', [Validators.required]],
      startDate: [null, [Validators.required]],
      endDate: [null, [Validators.required]],
      workCenterId: ['', [Validators.required]]
    });

    // Custom validator for end date after start date
    this.workOrderForm.get('endDate')?.setValidators([
      Validators.required,
      this.endDateAfterStartDateValidator.bind(this)
    ]);
  }

  /**
   * Custom validator to ensure end date is after start date.
   * Compares NgbDateStruct values by converting them to Date objects.
   * 
   * @param control - The end date FormControl
   * @returns Validation error object if end date is before start date, null otherwise
   */
  private endDateAfterStartDateValidator(control: any): { [key: string]: any } | null {
    const startDate = this.workOrderForm?.get('startDate')?.value;
    const endDate = control.value;
    
    if (!startDate || !endDate) {
      return null;
    }

    const start = this.ngbDateToDate(startDate);
    const end = this.ngbDateToDate(endDate);

    if (end < start) {
      return { endDateBeforeStart: true };
    }

    return null;
  }

  private resetForm(): void {
    this.workOrderForm.reset();
    this.overlapError = '';
    this.workOrderForm.patchValue({
      status: 'open',
      workCenterId: this.workCenterId || ''
    });
  }

  private setInitialDates(): void {
    const start = this.startDate || new Date();
    let end: Date;
    
    if (this.endDate) {
      // Use provided endDate (from selection range)
      end = this.endDate;
    } else {
      // Default 7 days duration
      end = new Date(start);
      end.setDate(end.getDate() + 7);
    }

    this.workOrderForm.patchValue({
      startDate: this.dateToNgbDate(start),
      endDate: this.dateToNgbDate(end),
      workCenterId: this.workCenterId || ''
    });
  }

  private populateForm(order: WorkOrderDocument): void {
    this.workOrderForm.patchValue({
      name: order.data.name,
      status: order.data.status,
      startDate: this.dateToNgbDate(new Date(order.data.startDate)),
      endDate: this.dateToNgbDate(new Date(order.data.endDate)),
      workCenterId: order.data.workCenterId
    });
  }

  onClose(): void {
    this.close.emit();
  }

  onSubmit(): void {
    if (this.workOrderForm.invalid) {
      this.markFormGroupTouched(this.workOrderForm);
      return;
    }

    const formValue = this.workOrderForm.value;
    if (!formValue.startDate || !formValue.endDate || !formValue.name || !formValue.workCenterId || !formValue.status) {
      return;
    }

    const startDate = this.ngbDateToDate(formValue.startDate);
    const endDate = this.ngbDateToDate(formValue.endDate);

    // Check for overlap
    const excludeDocId = this.mode === 'edit' ? this.workOrder?.docId : undefined;
    const hasOverlap = this.workOrderService.checkOverlap(
      formValue.workCenterId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      excludeDocId
    );

    if (hasOverlap) {
      this.overlapError = 'This work order overlaps with an existing order on the same work center.';
      return;
    }

    this.overlapError = '';

    if (this.mode === 'create') {
      const newOrder: Omit<WorkOrderDocument, 'docId'> = {
        docType: 'workOrder',
        data: {
          name: formValue.name as string,
          workCenterId: formValue.workCenterId as string,
          status: formValue.status as WorkOrderStatus,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      };
      const created = this.workOrderService.createWorkOrder(newOrder);
      this.save.emit(created);
    } else if (this.mode === 'edit' && this.workOrder) {
      this.workOrderService.updateWorkOrder(this.workOrder.docId, {
        name: formValue.name as string,
        workCenterId: formValue.workCenterId as string,
        status: formValue.status as WorkOrderStatus,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
      const updated = this.workOrderService.getWorkOrderById(this.workOrder.docId);
      if (updated) {
        this.save.emit(updated);
      }
    }

    this.onClose();
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Converts a JavaScript Date object to NgbDateStruct format required by ngb-datepicker.
   * Note: NgbDateStruct uses 1-based months (1-12) while Date uses 0-based months (0-11).
   * 
   * @param date - JavaScript Date object
   * @returns NgbDateStruct with year, month (1-12), and day
   */
  private dateToNgbDate(date: Date): NgbDateStruct {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1, // Convert 0-based to 1-based
      day: date.getDate()
    };
  }

  /**
   * Converts an NgbDateStruct to a JavaScript Date object.
   * Note: NgbDateStruct uses 1-based months, so we subtract 1 when creating Date.
   * 
   * @param ngbDate - NgbDateStruct from ngb-datepicker
   * @returns JavaScript Date object
   */
  private ngbDateToDate(ngbDate: NgbDateStruct): Date {
    return new Date(ngbDate.year, ngbDate.month - 1, ngbDate.day); // Convert 1-based to 0-based
  }

  getStatusColor(status: WorkOrderStatus): string {
    switch (status) {
      case 'open':
        return '#3B82F6'; // Blue
      case 'in-progress':
        return '#A855F7'; // Purple
      case 'complete':
        return '#10B981'; // Green
      case 'blocked':
        return '#F59E0B'; // Orange/Yellow
      default:
        return '#6B7280';
    }
  }

  onStartDateSelect(date: NgbDateStruct): void {
    this.workOrderForm.patchValue({ startDate: date });
    // Re-validate end date
    this.workOrderForm.get('endDate')?.updateValueAndValidity();
  }

  onEndDateSelect(date: NgbDateStruct): void {
    this.workOrderForm.patchValue({ endDate: date });
  }

  onStartDateModelChange(value: NgbDateStruct | null): void {
    // Sync ngModel value with form control
    if (value) {
      this.workOrderForm.patchValue({ startDate: value }, { emitEvent: false });
      // Re-validate end date
      this.workOrderForm.get('endDate')?.updateValueAndValidity();
    }
  }

  onEndDateModelChange(value: NgbDateStruct | null): void {
    // Sync ngModel value with form control
    if (value) {
      this.workOrderForm.patchValue({ endDate: value }, { emitEvent: false });
    }
  }

  formatDate(ngbDate: NgbDateStruct | null): string {
    if (!ngbDate) return '';
    const date = this.ngbDateToDate(ngbDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Formats NgbDateStruct for display in input field
   */
  getDateDisplayValue(ngbDate: NgbDateStruct | null): string {
    if (!ngbDate) return '';
    return this.formatDate(ngbDate);
  }


  get workCenters() {
    return this.workOrderService.getWorkCenters();
  }

  get isFormInvalid(): boolean {
    return this.workOrderForm.invalid && this.workOrderForm.touched;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isOpen) {
      this.onClose();
    }
  }
}
