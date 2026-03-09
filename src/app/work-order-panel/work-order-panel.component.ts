import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener, ChangeDetectorRef, ViewChild, ElementRef, Injectable, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { NgbDatepickerModule, NgbDateStruct, NgbDateParserFormatter } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { WorkOrderService } from '../services/work-order.service';
import { WorkOrderDocument, WorkOrderStatus } from '../models/work-order.model';

// Custom date parser formatter for MM-DD-YYYY format
@Injectable()
export class CustomDateParserFormatter extends NgbDateParserFormatter {

  parse(value: string): NgbDateStruct | null {
    if (!value) return null;

    const parts = value.split('-');
    if (parts.length !== 3) return null;

    return {
      month: +parts[0],
      day: +parts[1],
      year: +parts[2]
    };
  }

  format(date: NgbDateStruct | null): string {
    if (!date) return '';

    const mm = String(date.month).padStart(2, '0');
    const dd = String(date.day).padStart(2, '0');
    const yyyy = date.year;

    return `${mm}-${dd}-${yyyy}`;
  }
}

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
  providers: [
    { provide: NgbDateParserFormatter, useClass: CustomDateParserFormatter }
  ],
  templateUrl: './work-order-panel.component.html',
  styleUrl: './work-order-panel.component.scss'
})
export class WorkOrderPanelComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() isOpen: boolean = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() workCenterId: string = '';
  @Input() startDate: Date = new Date();
  @Input() endDate?: Date;
  @Input() workOrder: WorkOrderDocument | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<WorkOrderDocument>();

  @ViewChild('startDateInput', { static: false }) startDateInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('endDateInput', { static: false }) endDateInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('statusSelect', { static: false }) statusSelectRef?: any;

  workOrderForm!: FormGroup;
  overlapError: string = '';
  isStatusSelectFocused: boolean = false;

  statusOptions: { value: WorkOrderStatus; label: string }[] = [
    { value: 'open', label: 'Open' },
    { value: 'in-progress', label: 'In progress' },
    { value: 'complete', label: 'Complete' },
    { value: 'blocked', label: 'Blocked' }
  ];

  constructor(
    private fb: FormBuilder,
    private workOrderService: WorkOrderService,
    private dateParserFormatter: NgbDateParserFormatter
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.initForm();
  }

  ngAfterViewInit(): void {
    // Listen for focus events on the ng-select input
    setTimeout(() => {
      if (this.statusSelectRef) {
        const inputElement = this.statusSelectRef.element?.querySelector('input');
        if (inputElement) {
          inputElement.addEventListener('focus', () => {
            this.isStatusSelectFocused = true;
          });
          inputElement.addEventListener('blur', () => {
            this.isStatusSelectFocused = false;
          });
        }
      }
    }, 0);
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
    // When opening in edit mode, workOrder may arrive in same or next change — ensure form is populated
    if (changes['workOrder'] && this.isOpen && this.mode === 'edit' && this.workOrder) {
      this.populateForm(this.workOrder);
    }
    // Update dates if startDate or endDate changes while panel is open (create mode only)
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

  // @upgrade: Add smooth slide-in/slide-out animations for panel.
  // Consider CSS transitions or Angular animations API for polished entrance/exit effects.
  // Could add backdrop fade-in animation and panel slide from right with easing.
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

    // Format dates to ISO string without timezone issues
    const startDateStr = this.dateToISOString(startDate);
    const endDateStr = this.dateToISOString(endDate);

    // Check for overlap
    const excludeDocId = this.mode === 'edit' ? this.workOrder?.docId : undefined;
    const hasOverlap = this.workOrderService.checkOverlap(
      formValue.workCenterId,
      startDateStr,
      endDateStr,
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
          startDate: startDateStr,
          endDate: endDateStr
        }
      };
      const created = this.workOrderService.createWorkOrder(newOrder);
      this.save.emit(created);
    } else if (this.mode === 'edit' && this.workOrder) {
      this.workOrderService.updateWorkOrder(this.workOrder.docId, {
        name: formValue.name as string,
        workCenterId: formValue.workCenterId as string,
        status: formValue.status as WorkOrderStatus,
        startDate: startDateStr,
        endDate: endDateStr
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
   * Sets time to noon to avoid timezone issues when converting to ISO string.
   * 
   * @param ngbDate - NgbDateStruct from ngb-datepicker
   * @returns JavaScript Date object
   */
  private ngbDateToDate(ngbDate: NgbDateStruct): Date {
    // Use noon to avoid timezone issues when converting to ISO string
    return new Date(ngbDate.year, ngbDate.month - 1, ngbDate.day, 12, 0, 0, 0);
  }

  /**
   * Formats a Date to ISO string (YYYY-MM-DD) without timezone issues.
   * 
   * @param date - JavaScript Date object
   * @returns ISO date string in format YYYY-MM-DD
   */
  private dateToISOString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  getStatusTextColor(status: string): string {
    switch (status) {
      case 'in-progress':
        return 'rgba(62, 64, 219, 1)';
      case 'complete':
        return 'rgba(8, 162, 104, 1)';
      case 'blocked':
        return 'rgba(177, 54, 0, 1)';
      case 'open':
        return 'rgba(0, 176, 191, 1)';
      default:
        return 'rgba(0, 176, 191, 1)'; // Default to open color
    }
  }

  getStatusBackgroundColor(status: string): string {
    switch (status) {
      case 'in-progress':
        return 'rgba(214, 216, 255, 1)';
      case 'complete':
        return 'rgba(225, 255, 204, 1)';
      case 'blocked':
        return 'rgba(252, 238, 181, 1)';
      case 'open':
        return 'rgba(228, 253, 255, 1)';
      default:
        return 'rgba(228, 253, 255, 1)'; // Default to open background
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'open':
        return 'Open';
      case 'in-progress':
        return 'In progress';
      case 'complete':
        return 'Complete';
      case 'blocked':
        return 'Blocked';
      default:
        return status;
    }
  }

  onStartDateSelect(date: NgbDateStruct): void {
    this.workOrderForm.patchValue({ startDate: date });
    // Re-validate end date
    this.workOrderForm.get('endDate')?.updateValueAndValidity();
    // Force update the input display with formatted value immediately and after datepicker updates
    const formatted = this.dateParserFormatter.format(date);
    requestAnimationFrame(() => {
      if (this.startDateInputRef) {
        this.startDateInputRef.nativeElement.value = formatted;
      }
      // Also update after a short delay to override datepicker's default format
      setTimeout(() => {
        if (this.startDateInputRef) {
          this.startDateInputRef.nativeElement.value = formatted;
        }
      }, 10);
    });
  }

  onEndDateSelect(date: NgbDateStruct): void {
    this.workOrderForm.patchValue({ endDate: date });
    // Force update the input display with formatted value immediately and after datepicker updates
    const formatted = this.dateParserFormatter.format(date);
    requestAnimationFrame(() => {
      if (this.endDateInputRef) {
        this.endDateInputRef.nativeElement.value = formatted;
      }
      // Also update after a short delay to override datepicker's default format
      setTimeout(() => {
        if (this.endDateInputRef) {
          this.endDateInputRef.nativeElement.value = formatted;
        }
      }, 10);
    });
  }



  formatDate(ngbDate: NgbDateStruct | null): string {
    if (!ngbDate) return '';
    const date = this.ngbDateToDate(ngbDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }



  get workCenters() {
    return this.workOrderService.getWorkCenters();
  }

  get isFormInvalid(): boolean {
    return this.workOrderForm.invalid && this.workOrderForm.touched;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(_event: Event): void {
    if (this.isOpen) {
      this.onClose();
    }
  }
}
