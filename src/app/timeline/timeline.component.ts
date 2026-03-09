import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { WorkOrderService } from '../services/work-order.service';
import { WorkCenterDocument } from '../models/work-center.model';
import { WorkOrderDocument } from '../models/work-order.model';
import { Subject, takeUntil } from 'rxjs';

export type Timescale = 'hour' | 'day' | 'week' | 'month';

interface TimelineColumn {
  date: Date;
  label: string;
  width: number;
}

interface WorkOrderBar {
  order: WorkOrderDocument;
  left: number;
  width: number;
  workCenterIndex: number;
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss'
})
export class TimelineComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('timelineContainer', { static: false }) timelineContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('timelineGrid', { static: false }) timelineGrid!: ElementRef<HTMLDivElement>;
  @ViewChild('workCenterColumn', { static: false }) workCenterColumn!: ElementRef<HTMLDivElement>;

  workCenters: WorkCenterDocument[] = [];
  workOrders: WorkOrderDocument[] = [];
  timescale: Timescale = 'day';
  timescaleOptions: { value: Timescale; label: string }[] = [
    { value: 'hour', label: 'Hour' },
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' }
  ];

  columns: TimelineColumn[] = [];
  workOrderBars: WorkOrderBar[] = [];
  currentDate = new Date();
  hoveredWorkCenterIndex: number | null = null;
  selectedWorkOrder: WorkOrderDocument | null = null;
  showActionsMenu: { orderId: string; x: number; y: number } | null = null;
  hoveredTimelineCell: { workCenterIndex: number; x: number; tooltipLeft: number; tooltipTop: number } | null = null;
  
  // Selection state
  isSelecting: boolean = false;
  selectionStart: { x: number; workCenterIndex: number } | null = null;
  selectionEnd: { x: number; workCenterIndex: number } | null = null;
  selectionRange: { left: number; width: number; workCenterIndex: number; top: number } | null = null;
  mouseDownPosition: { x: number; y: number } | null = null;

  private destroy$ = new Subject<void>();
  readonly ROW_HEIGHT = 60; // Updated from 36px to match Sketch exact value
  readonly COLUMN_WIDTH_HOUR = 60; // Width for hour columns
  readonly COLUMN_WIDTH_DAY = 114; // Updated from 40 to match Sketch exact value
  readonly COLUMN_WIDTH_WEEK = 114; // Updated from 100 to match Sketch exact value
  readonly COLUMN_WIDTH_MONTH = 114; // Updated from 200 to match Sketch exact value
  // Buffer ranges for initial visible date range based on zoom level
  // Hour view: ±24 hours (1 day), Day view: ±2 weeks (14 days), Week view: ±2 months (~8 weeks), Month view: ±6 months
  private readonly BUFFER_HOURS_HOUR = 24;
  private readonly BUFFER_DAYS_DAY = 14;
  private readonly BUFFER_WEEKS_WEEK = 8;
  private readonly BUFFER_MONTHS_MONTH = 6;
  // Infinite scroll: load more when within this many viewport widths of edge
  private readonly INFINITE_SCROLL_THRESHOLD = 2;
  private readonly COLUMNS_TO_LOAD = 14;
  private readonly MAX_TOTAL_COLUMNS = 500;
  private isInfiniteScrollBusy = false;
  private scrollCheckRAF: number | null = null;
  private hoveredCellLeaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private workOrderService: WorkOrderService,
    private cdr: ChangeDetectorRef
  ) {}

  // @upgrade: Add full keyboard navigation support (arrow keys, tab, enter, escape).
  // Implement ARIA labels and roles for screen readers. Add focus management for work order cards.
  // Consider implementing skip links and proper focus trapping in modals.
  ngOnInit(): void {
    this.workOrderService.workCenters$
      .pipe(takeUntil(this.destroy$))
      .subscribe(centers => {
        this.workCenters = centers;
        this.calculateTimeline();
      });

    this.workOrderService.workOrders$
      .pipe(takeUntil(this.destroy$))
      .subscribe(orders => {
        this.workOrders = orders;
        this.calculateTimeline();
      });
  }

  ngAfterViewInit(): void {
    this.calculateTimeline();
    // Scroll to center on current date
    setTimeout(() => this.scrollToCurrentDate(), 100);
    
    // Add global mouse event listeners for selection
    document.addEventListener('mousedown', this.onDocumentMouseDown.bind(this));
    document.addEventListener('mousemove', this.onDocumentMouseMove.bind(this));
    document.addEventListener('mouseup', this.onDocumentMouseUp.bind(this));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.scrollCheckRAF != null) cancelAnimationFrame(this.scrollCheckRAF);
    if (this.hoveredCellLeaveTimer) clearTimeout(this.hoveredCellLeaveTimer);
    document.removeEventListener('mousedown', this.onDocumentMouseDown.bind(this));
    document.removeEventListener('mousemove', this.onDocumentMouseMove.bind(this));
    document.removeEventListener('mouseup', this.onDocumentMouseUp.bind(this));
  }

  onTimescaleChange(): void {
    this.calculateTimeline();
    setTimeout(() => this.scrollToCurrentDate(), 50);
  }

  private checkInfiniteScroll(scrollElement: HTMLElement): void {
    if (this.columns.length === 0 || this.isInfiniteScrollBusy) return;
    const scrollLeft = scrollElement.scrollLeft;
    const clientWidth = scrollElement.clientWidth;
    const threshold = clientWidth * this.INFINITE_SCROLL_THRESHOLD;
    const totalColumnsWidth = this.columns.reduce((s, c) => s + c.width, 0);

    if (this.columns.length >= this.MAX_TOTAL_COLUMNS) return;

    const nearLeft = scrollLeft < threshold;
    const nearRight = scrollLeft + clientWidth > totalColumnsWidth - threshold;

    if (nearLeft) {
      this.prependColumns();
    } else if (nearRight) {
      this.appendColumns();
    }
  }

  private prependColumns(): void {
    if (this.columns.length === 0 || this.columns.length >= this.MAX_TOTAL_COLUMNS || this.isInfiniteScrollBusy) return;
    this.isInfiniteScrollBusy = true;

    const columnWidth = this.getColumnWidth();
    const newColumns = this.generateColumnsInRange(
      this.columns[0].date,
      -this.COLUMNS_TO_LOAD
    );
    if (newColumns.length === 0) {
      this.isInfiniteScrollBusy = false;
      return;
    }

    const addedWidth = newColumns.length * columnWidth;
    const el = this.timelineGrid?.nativeElement;
    const previousScrollLeft = el?.scrollLeft ?? 0;

    this.columns = [...newColumns, ...this.columns];
    this.workOrderBars = this.calculateWorkOrderBars();
    this.cdr.detectChanges();

    if (el) {
      requestAnimationFrame(() => {
        el.scrollLeft = previousScrollLeft + addedWidth;
        this.isInfiniteScrollBusy = false;
      });
    } else {
      this.isInfiniteScrollBusy = false;
    }
  }

  private appendColumns(): void {
    if (this.columns.length === 0 || this.columns.length >= this.MAX_TOTAL_COLUMNS || this.isInfiniteScrollBusy) return;
    const lastCol = this.columns[this.columns.length - 1];
    const newColumns = this.generateColumnsInRange(lastCol.date, this.COLUMNS_TO_LOAD, true);
    if (newColumns.length === 0) return;

    this.columns = [...this.columns, ...newColumns];
    this.workOrderBars = this.calculateWorkOrderBars();
    this.cdr.detectChanges();
  }

  goToCurrent(): void {
    this.currentDate = new Date();
    this.calculateTimeline();
    setTimeout(() => this.scrollToCurrentDate(), 50);
  }

  get goToCurrentLabel(): string {
    const labels: Record<Timescale, string> = {
      hour: 'Go to current hour',
      day: 'Go to current day',
      week: 'Go to current week',
      month: 'Go to current month'
    };
    return labels[this.timescale];
  }

  onTimelineScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (this.workCenterColumn?.nativeElement) {
      const scrollTop = target.scrollTop;
      this.workCenterColumn.nativeElement.scrollTop = scrollTop;
    }
    if (this.scrollCheckRAF != null) cancelAnimationFrame(this.scrollCheckRAF);
    this.scrollCheckRAF = requestAnimationFrame(() => {
      this.checkInfiniteScroll(target);
      this.scrollCheckRAF = null;
    });
  }

  calculateTimeline(): void {
    this.columns = this.generateColumns();
    this.workOrderBars = this.calculateWorkOrderBars();
    this.cdr.detectChanges();
  }

  // @upgrade: Consider implementing virtual scrolling for very large date ranges.
  // For month view with many months, rendering all columns could impact performance.
  // Virtual scrolling would only render visible columns and dynamically load/unload as user scrolls.
  private generateColumns(): TimelineColumn[] {
    const columns: TimelineColumn[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate: Date;
    let endDate: Date;
    let columnWidth: number;
    let dateIncrement: (date: Date) => Date;

    switch (this.timescale) {
      case 'hour':
        // Hour view: Show ±24 hours (1 day) centered on current hour
        startDate = new Date(today);
        startDate.setHours(startDate.getHours() - this.BUFFER_HOURS_HOUR, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(endDate.getHours() + this.BUFFER_HOURS_HOUR, 0, 0, 0);
        columnWidth = this.COLUMN_WIDTH_HOUR;
        dateIncrement = (date: Date) => {
          const next = new Date(date);
          next.setHours(next.getHours() + 1);
          return next;
        };
        break;
      case 'day':
        // Day view: Show ±2 weeks (14 days) centered on today
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - this.BUFFER_DAYS_DAY);
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() + this.BUFFER_DAYS_DAY);
        columnWidth = this.COLUMN_WIDTH_DAY;
        dateIncrement = (date: Date) => {
          const next = new Date(date);
          next.setDate(next.getDate() + 1);
          return next;
        };
        break;
      case 'week':
        // Week view: Show ±2 months (~8 weeks) centered on today
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (this.BUFFER_WEEKS_WEEK * 7));
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() + (this.BUFFER_WEEKS_WEEK * 7));
        columnWidth = this.COLUMN_WIDTH_WEEK;
        dateIncrement = (date: Date) => {
          const next = new Date(date);
          next.setDate(next.getDate() + 7);
          return next;
        };
        break;
      case 'month':
        // Month view: Show ±6 months centered on today
        startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - this.BUFFER_MONTHS_MONTH);
        startDate.setDate(1);
        endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + this.BUFFER_MONTHS_MONTH);
        endDate.setDate(1);
        // Include the end month by setting to first day of next month
        // The loop will include it before incrementing
        columnWidth = this.COLUMN_WIDTH_MONTH;
        dateIncrement = (date: Date) => {
          const next = new Date(date);
          next.setMonth(next.getMonth() + 1);
          next.setDate(1);
          return next;
        };
        break;
    }

    let currentDate = new Date(startDate);
    // For month view, include one more month to ensure endDate month is included
    const endDateForLoop = this.timescale === 'month' 
      ? new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1) // First day of month after endDate
      : endDate;
    
    // Calculate max columns based on timescale to prevent too many columns
    // For month view, calculate dynamically based on the date range
    let maxColumns: number;
    switch (this.timescale) {
      case 'hour':
        maxColumns = 48; // ±24 hours
        break;
      case 'day':
        maxColumns = 50; // ±14 days + buffer
        break;
      case 'week':
        maxColumns = 20; // ±8 weeks + buffer
        break;
      case 'month':
        // Calculate the actual number of months needed
        // For ±6 months, we need: 6 (before) + 1 (current) + 6 (after) = 13 months
        // Plus the extra month from endDateForLoop = 14 months total
        // Add buffer for safety
        const monthsDiff = (endDateForLoop.getFullYear() - startDate.getFullYear()) * 12 + 
                          (endDateForLoop.getMonth() - startDate.getMonth());
        maxColumns = monthsDiff + 5; // Add 5 month buffer for safety
        break;
      default:
        maxColumns = 100;
    }
    
    while (currentDate < endDateForLoop) {
      const label = this.formatColumnLabel(currentDate);
      columns.push({
        date: new Date(currentDate),
        label,
        width: columnWidth
      });
      const nextDate = dateIncrement(currentDate);
      
      // Safety check to prevent infinite loops
      if (nextDate <= currentDate) break;
      
      // Only check maxColumns as a safety limit, but prioritize reaching endDateForLoop
      if (columns.length >= maxColumns && currentDate >= endDateForLoop) break;
      
      currentDate = nextDate;
    }

    return columns;
  }

  private formatColumnLabel(date: Date): string {
    switch (this.timescale) {
      case 'hour':
        return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      default:
        return date.toLocaleDateString();
    }
  }

  /**
   * Generate columns for infinite scroll. When count < 0, generates columns before anchorDate.
   * When count > 0, generates columns after anchorDate (skipFirst=true skips the anchor itself).
   */
  private generateColumnsInRange(
    anchorDate: Date,
    count: number,
    skipFirst: boolean = false
  ): TimelineColumn[] {
    const columnWidth = this.getColumnWidth();
    const columns: TimelineColumn[] = [];

    let dateIncrement: (date: Date) => Date;
    let dateDecrement: (date: Date) => Date;

    switch (this.timescale) {
      case 'hour':
        dateIncrement = (d: Date) => {
          const next = new Date(d);
          next.setHours(next.getHours() + 1);
          return next;
        };
        dateDecrement = (d: Date) => {
          const prev = new Date(d);
          prev.setHours(prev.getHours() - 1);
          return prev;
        };
        break;
      case 'day':
        dateIncrement = (d: Date) => {
          const next = new Date(d);
          next.setDate(next.getDate() + 1);
          return next;
        };
        dateDecrement = (d: Date) => {
          const prev = new Date(d);
          prev.setDate(prev.getDate() - 1);
          return prev;
        };
        break;
      case 'week':
        dateIncrement = (d: Date) => {
          const next = new Date(d);
          next.setDate(next.getDate() + 7);
          return next;
        };
        dateDecrement = (d: Date) => {
          const prev = new Date(d);
          prev.setDate(prev.getDate() - 7);
          return prev;
        };
        break;
      case 'month':
        dateIncrement = (d: Date) => {
          const next = new Date(d);
          next.setMonth(next.getMonth() + 1);
          next.setDate(1);
          return next;
        };
        dateDecrement = (d: Date) => {
          const prev = new Date(d);
          prev.setMonth(prev.getMonth() - 1);
          prev.setDate(1);
          return prev;
        };
        break;
      default:
        return [];
    }

    if (count < 0) {
      let current = new Date(anchorDate);
      const n = Math.min(-count, this.MAX_TOTAL_COLUMNS);
      for (let i = 0; i < n; i++) {
        current = dateDecrement(current);
        columns.unshift({
          date: new Date(current),
          label: this.formatColumnLabel(current),
          width: columnWidth
        });
      }
    } else {
      let current = new Date(anchorDate);
      if (skipFirst) current = dateIncrement(current);
      const n = Math.min(count, this.MAX_TOTAL_COLUMNS);
      for (let i = 0; i < n; i++) {
        columns.push({
          date: new Date(current),
          label: this.formatColumnLabel(current),
          width: columnWidth
        });
        current = dateIncrement(current);
      }
    }

    return columns;
  }

  /**
   * Calculates the position and width of work order bars on the timeline.
   * Only includes orders that overlap with the visible date range.
   * Positions are calculated relative to the first column date.
   * 
   * @returns Array of work order bars with calculated positions
   */
  /**
   * Parses an ISO date string (YYYY-MM-DD) to a Date object without timezone issues.
   * 
   * @param isoString - Date string in format YYYY-MM-DD
   * @returns Date object in local timezone
   */
  private parseISODate(isoString: string): Date {
    const [year, month, day] = isoString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // @upgrade: For very large datasets (1000+ work orders), consider:
  // - Virtual scrolling for work order bars (only render visible bars)
  // - Intersection Observer API to detect visible bars
  // - Debouncing/throttling of calculations on scroll
  // - Web Workers for heavy date calculations
  private calculateWorkOrderBars(): WorkOrderBar[] {
    if (this.columns.length === 0) return [];

    const bars: WorkOrderBar[] = [];
    const firstColumnDate = new Date(this.columns[0].date);
    if (this.timescale !== 'hour') {
      firstColumnDate.setHours(0, 0, 0, 0);
    } else {
      firstColumnDate.setMinutes(0, 0, 0);
    }
    
    // Calculate the end of the visible range based on timescale
    let lastColumnDate: Date;
    const lastColumn = this.columns[this.columns.length - 1];
    if (this.timescale === 'hour') {
      // For hour view, the last column represents the last hour
      // The visible range extends to the end of that hour (59 minutes, 59 seconds)
      lastColumnDate = new Date(lastColumn.date);
      lastColumnDate.setMinutes(59, 59, 999);
    } else if (this.timescale === 'month') {
      // For month view, the last column represents the first day of that month
      // The visible range extends to the end of that month
      lastColumnDate = new Date(lastColumn.date.getFullYear(), lastColumn.date.getMonth() + 1, 0);
      lastColumnDate.setHours(23, 59, 59, 999);
    } else if (this.timescale === 'week') {
      // For week view, the last column represents the start of that week
      // The visible range extends to the end of that week (Saturday)
      lastColumnDate = new Date(lastColumn.date);
      lastColumnDate.setDate(lastColumn.date.getDate() - lastColumn.date.getDay() + 6);
      lastColumnDate.setHours(23, 59, 59, 999);
    } else {
      // For day view, the last column is the last day
      lastColumnDate = new Date(lastColumn.date);
      lastColumnDate.setHours(23, 59, 59, 999);
    }

    this.workOrders.forEach(order => {
      // Parse ISO date strings (YYYY-MM-DD) without timezone issues
      const orderStart = this.parseISODate(order.data.startDate);
      const orderEnd = this.parseISODate(order.data.endDate);
      if (this.timescale !== 'hour') {
        orderStart.setHours(0, 0, 0, 0);
        orderEnd.setHours(23, 59, 59, 999);
      } else {
        // For hour view, keep the exact time
        orderStart.setSeconds(0, 0);
        orderEnd.setSeconds(59, 999);
      }
      
      // Only show orders that overlap with visible range
      // An order overlaps if it starts before the range ends AND ends after the range starts
      if (orderEnd < firstColumnDate || orderStart > lastColumnDate) {
        return;
      }

      const workCenterIndex = this.workCenters.findIndex(wc => wc.docId === order.data.workCenterId);
      if (workCenterIndex === -1) return;

      // Clamp order dates to visible range to prevent bars from extending beyond timeline
      const startDate = orderStart < firstColumnDate ? new Date(firstColumnDate) : new Date(orderStart);
      const endDate = orderEnd > lastColumnDate ? new Date(lastColumnDate) : new Date(orderEnd);

      // Calculate pixel positions relative to the first column
      // For startDate, use the start of the period
      // For endDate, use the end of the period to include the full day/week/month
      const left = this.calculateDatePosition(startDate, firstColumnDate, false);
      const right = this.calculateDatePosition(endDate, firstColumnDate, true); // true = end of period
      const width = Math.max(right - left, 20); // Minimum width of 20px for visibility

      bars.push({
        order,
        left,
        width,
        workCenterIndex
      });
    });

    return bars;
  }

  /**
   * Calculates the pixel position of a date within the timeline.
   * Converts date differences to pixel positions based on the current zoom level.
   * 
   * @param date - The target date to position
   * @param startDate - The first date in the visible timeline range
   * @param isEndDate - If true, position at the end of the period (end of day/week/month), otherwise at the start
   * @returns Pixel position from the left edge of the timeline
   */
  calculateDatePosition(date: Date, startDate: Date, isEndDate: boolean = false): number {
    const normalizedDate = new Date(date);
    const normalizedStart = new Date(startDate);
    
    switch (this.timescale) {
      case 'hour':
        // For hour view, use exact time
        const diffTimeHour = normalizedDate.getTime() - normalizedStart.getTime();
        const diffHours = diffTimeHour / (1000 * 60 * 60);
        if (isEndDate) {
          // Position at the end of the hour
          return (diffHours + 1) * this.COLUMN_WIDTH_HOUR;
        }
        return diffHours * this.COLUMN_WIDTH_HOUR;
      case 'day':
        // Normalize to start of day for consistent calculations
        normalizedDate.setHours(0, 0, 0, 0);
        normalizedStart.setHours(0, 0, 0, 0);
        const diffTime = normalizedDate.getTime() - normalizedStart.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (isEndDate) {
          // Position at the end of the day (start of next day)
          return (diffDays + 1) * this.COLUMN_WIDTH_DAY;
        }
        return diffDays * this.COLUMN_WIDTH_DAY;
      case 'week':
        // Normalize to start of day
        normalizedDate.setHours(0, 0, 0, 0);
        normalizedStart.setHours(0, 0, 0, 0);
        const diffTimeWeek = normalizedDate.getTime() - normalizedStart.getTime();
        const diffDaysWeek = diffTimeWeek / (1000 * 60 * 60 * 24);
        const diffWeeks = diffDaysWeek / 7;
        if (isEndDate) {
          // Position at the end of the week (start of next week)
          return (diffWeeks + 1) * this.COLUMN_WIDTH_WEEK;
        }
        return diffWeeks * this.COLUMN_WIDTH_WEEK;
      case 'month':
        // Normalize to start of day
        normalizedDate.setHours(0, 0, 0, 0);
        normalizedStart.setHours(0, 0, 0, 0);
        // Calculate month difference accounting for year changes
        const yearDiff = normalizedDate.getFullYear() - normalizedStart.getFullYear();
        const monthDiff = normalizedDate.getMonth() - normalizedStart.getMonth();
        const totalMonths = yearDiff * 12 + monthDiff;
        if (isEndDate) {
          // Position at the end of the month (start of next month)
          return (totalMonths + 1) * this.COLUMN_WIDTH_MONTH;
        }
        // For dates within a month, calculate the fraction of the month
        const dayOfMonth = normalizedDate.getDate();
        const daysInMonth = new Date(normalizedDate.getFullYear(), normalizedDate.getMonth() + 1, 0).getDate();
        const monthFraction = dayOfMonth / daysInMonth;
        return (totalMonths + monthFraction) * this.COLUMN_WIDTH_MONTH;
      default:
        return 0;
    }
  }

  /** Public so parent can call after create/edit/delete to recenter on current date. */
  scrollToCurrentDate(): void {
    if (!this.timelineGrid?.nativeElement) return;

    const currentDatePos = this.calculateDatePosition(
      this.currentDate,
      this.columns[0]?.date || new Date()
    );
    const containerWidth = this.timelineGrid.nativeElement.clientWidth;
    const scrollPosition = currentDatePos - containerWidth / 2;

    this.timelineGrid.nativeElement.scrollLeft = Math.max(0, scrollPosition);
  }

  onTimelineClick(event: MouseEvent, workCenterIndex: number): void {
    // Don't trigger if clicking on work order bar, actions menu, or if there's an active selection
    if ((event.target as HTMLElement).closest('.work-order-bar') ||
        (event.target as HTMLElement).closest('.actions-menu') ||
        (event.target as HTMLElement).closest('.selection-menu') ||
        this.selectionRange) {
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const scrollLeft = this.timelineGrid?.nativeElement?.scrollLeft || 0;
    const absoluteX = clickX + scrollLeft;

    const clickedDate = this.calculateDateFromPosition(absoluteX);
    const workCenter = this.workCenters[workCenterIndex];

    // Emit event to parent to open create panel
    this.createWorkOrder.emit({
      workCenterId: workCenter.docId,
      startDate: clickedDate
    });
  }

  onTimelineRowMouseMove(event: MouseEvent, workCenterIndex: number): void {
    // Only show placeholder if not hovering over a work order bar
    if ((event.target as HTMLElement).closest('.work-order-bar')) {
      this.hoveredTimelineCell = null;
      return;
    }

    const gridEl = this.timelineGrid?.nativeElement;
    if (!gridEl) return;

    const gridRect = gridEl.getBoundingClientRect();
    const scrollLeft = gridEl.scrollLeft || 0;
    const clickX = event.clientX - gridRect.left;
    const absoluteX = clickX + scrollLeft;

    const columnWidth = this.getColumnWidth();
    const columnIndex = Math.floor(absoluteX / columnWidth);
    
    if (columnIndex < 0 || columnIndex >= this.columns.length) {
      this.hoveredTimelineCell = null;
      return;
    }

    const columnStartX = columnIndex * columnWidth;
    
    const hasOrder = this.getBarsForWorkCenter(this.workCenters[workCenterIndex].docId)
      .some(bar => {
        const barStart = bar.left;
        const barEnd = bar.left + bar.width;
        return (absoluteX >= barStart && absoluteX <= barEnd);
      });

    if (!hasOrder) {
      if (this.hoveredCellLeaveTimer) {
        clearTimeout(this.hoveredCellLeaveTimer);
        this.hoveredCellLeaveTimer = null;
      }
      const columnCenterX = columnStartX + columnWidth / 2;
      const tooltipLeft = gridRect.left + (columnCenterX - scrollLeft);
      const tooltipTop = event.clientY - 38;
      this.hoveredTimelineCell = {
        workCenterIndex,
        x: columnStartX,
        tooltipLeft,
        tooltipTop
      };
      this.cdr.detectChanges();
    } else {
      this.hoveredTimelineCell = null;
    }
  }

  getColumnWidth(): number {
    switch (this.timescale) {
      case 'hour':
        return this.COLUMN_WIDTH_HOUR;
      case 'day':
        return this.COLUMN_WIDTH_DAY;
      case 'week':
        return this.COLUMN_WIDTH_WEEK;
      case 'month':
        return this.COLUMN_WIDTH_MONTH;
      default:
        return this.COLUMN_WIDTH_DAY;
    }
  }

  /**
   * Calculate the left position of a column separator
   * Used for rendering vertical grid lines at the start of each column
   */
  getColumnLeftPosition(column: { date: Date; label: string; width: number }): number {
    if (!this.columns || this.columns.length === 0) return 0;
    const columnIndex = this.columns.findIndex(c => 
      c.date.getTime() === column.date.getTime()
    );
    if (columnIndex === -1) return 0;
    // Position at the start (left edge) of each column
    return columnIndex * column.width;
  }

  /**
   * Calculate total width of timeline based on columns
   * Used to size the grid layer correctly
   */
  getTotalTimelineWidth(): number {
    if (!this.columns || this.columns.length === 0) return 0;
    // Sum the actual widths of all columns to get exact total width
    // For month view, add a larger buffer to ensure we can scroll to the end
    // The buffer needs to account for the viewport width to ensure full scrollability
    const totalWidth = this.columns.reduce((total, column) => total + column.width, 0);
    
    if (this.timescale === 'month') {
      // For months, add a buffer that's at least one viewport width to ensure
      // we can scroll past the last column completely
      const viewportWidth = this.timelineGrid?.nativeElement?.clientWidth || 1200;
      return totalWidth + Math.max(viewportWidth * 0.5, 100); // At least 50% of viewport or 100px
    }
    
    return totalWidth + 10; // Smaller buffer for other timescales
  }

  onTimelineRowMouseLeave(): void {
    if (this.hoveredCellLeaveTimer) clearTimeout(this.hoveredCellLeaveTimer);
    this.hoveredCellLeaveTimer = setTimeout(() => {
      this.hoveredTimelineCell = null;
      this.hoveredCellLeaveTimer = null;
      this.cdr.detectChanges();
    }, 150);
  }

  onTooltipMouseEnter(): void {
    if (this.hoveredCellLeaveTimer) {
      clearTimeout(this.hoveredCellLeaveTimer);
      this.hoveredCellLeaveTimer = null;
    }
  }

  // Selection handlers
  onTimelineRowMouseDown(event: MouseEvent, workCenterIndex: number): void {
    // Don't start selection if clicking on work order bar or actions menu
    if ((event.target as HTMLElement).closest('.work-order-bar') ||
        (event.target as HTMLElement).closest('.actions-menu') ||
        (event.target as HTMLElement).closest('.selection-menu')) {
      return;
    }

    // Only start selection on left mouse button
    if (event.button !== 0) return;

    // Store initial mouse position to detect if it's a drag or click
    this.mouseDownPosition = { x: event.clientX, y: event.clientY };

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const scrollLeft = this.timelineGrid?.nativeElement?.scrollLeft || 0;
    const absoluteX = clickX + scrollLeft;

    this.isSelecting = true;
    this.selectionStart = { x: absoluteX, workCenterIndex };
    this.selectionEnd = { x: absoluteX, workCenterIndex };
    this.updateSelectionRange();
  }

  onDocumentMouseDown(event: MouseEvent): void {
    // Close selection menu if clicking outside
    if (this.selectionRange && 
        !(event.target as HTMLElement).closest('.selection-menu') &&
        !(event.target as HTMLElement).closest('.timeline-selection-overlay')) {
      this.selectionRange = null;
      this.selectionStart = null;
      this.selectionEnd = null;
    }
  }

  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isSelecting || !this.selectionStart) return;

    // If mouse moved significantly, prevent click event (it's a drag)
    if (this.mouseDownPosition) {
      const deltaX = Math.abs(event.clientX - this.mouseDownPosition.x);
      const deltaY = Math.abs(event.clientY - this.mouseDownPosition.y);
      if (deltaX > 3 || deltaY > 3) {
        // User is dragging, prevent click event
        event.preventDefault();
      }
    }

    // Find which timeline row we're over
    const timelineRows = document.querySelectorAll('.timeline-row');
    let targetRowIndex = -1;
    let targetRow: HTMLElement | null = null;

    for (let i = 0; i < timelineRows.length; i++) {
      const rect = timelineRows[i].getBoundingClientRect();
      if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
        targetRowIndex = i;
        targetRow = timelineRows[i] as HTMLElement;
        break;
      }
    }

    if (targetRow && targetRowIndex >= 0) {
      const rect = targetRow.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const scrollLeft = this.timelineGrid?.nativeElement?.scrollLeft || 0;
      const absoluteX = clickX + scrollLeft;

      this.selectionEnd = { x: absoluteX, workCenterIndex: targetRowIndex };
      this.updateSelectionRange();
    }
  }

  onDocumentMouseUp(event: MouseEvent): void {
    if (this.isSelecting) {
      // If it was just a click (no significant movement), clear selection to allow click event
      if (this.mouseDownPosition) {
        const deltaX = Math.abs(event.clientX - this.mouseDownPosition.x);
        const deltaY = Math.abs(event.clientY - this.mouseDownPosition.y);
        if (deltaX <= 3 && deltaY <= 3) {
          // It was a click, not a drag - clear selection so click event can fire
          this.selectionRange = null;
          this.selectionStart = null;
          this.selectionEnd = null;
        }
      }
      this.isSelecting = false;
      this.mouseDownPosition = null;
    }
  }

  private updateSelectionRange(): void {
    if (!this.selectionStart || !this.selectionEnd) {
      this.selectionRange = null;
      return;
    }

    const startX = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const endX = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const width = endX - startX;

    // Only show selection if width is significant (at least 20px)
    if (width < 20) {
      this.selectionRange = null;
      return;
    }

    const scrollLeft = this.timelineGrid?.nativeElement?.scrollLeft || 0;
    const rowIndex = this.selectionStart.workCenterIndex;
    const rowElement = document.querySelectorAll('.timeline-row')[rowIndex] as HTMLElement;
    
    if (!rowElement) {
      this.selectionRange = null;
      return;
    }

    const rowRect = rowElement.getBoundingClientRect();
    const timelineRect = this.timelineGrid?.nativeElement?.getBoundingClientRect();
    
    if (!timelineRect) {
      this.selectionRange = null;
      return;
    }

    const timelineGridRect = this.timelineGrid?.nativeElement?.getBoundingClientRect();
    if (!timelineGridRect) {
      this.selectionRange = null;
      return;
    }

    this.selectionRange = {
      left: startX - scrollLeft,
      width: width,
      workCenterIndex: rowIndex,
      top: rowRect.top - timelineGridRect.top + 48 // 48px header height (updated to match Sketch)
    };
  }

  onSelectionCreate(): void {
    if (!this.selectionRange || !this.selectionStart || !this.selectionEnd) return;

    const startDate = this.calculateDateFromPosition(
      this.selectionStart.x
    );
    const endDate = this.calculateDateFromPosition(
      this.selectionEnd.x
    );
    const workCenter = this.workCenters[this.selectionRange.workCenterIndex];

    this.selectionRange = null;
    this.selectionStart = null;
    this.selectionEnd = null;

    this.createWorkOrder.emit({
      workCenterId: workCenter.docId,
      startDate: startDate,
      endDate: endDate
    });
  }

  onSelectionEdit(): void {
    // For now, just clear selection
    // In a full implementation, this might open an edit dialog for the selected range
    this.selectionRange = null;
    this.selectionStart = null;
    this.selectionEnd = null;
  }

  getSelectionMenuLeft(): number {
    if (!this.selectionRange) return 0;
    const scrollLeft = this.timelineGrid?.nativeElement?.scrollLeft || 0;
    return this.selectionRange.left + this.selectionRange.width / 2 + scrollLeft;
  }

  getSelectionMenuTop(): number {
    if (!this.selectionRange) return 0;
    return this.selectionRange.top - 45; // Position menu 45px above selection
  }

  /**
   * Converts a pixel position (x coordinate) to a date.
   * Used when user clicks on the timeline to determine which date was clicked.
   * 
   * @param x - Pixel position from the left edge of the timeline (including scroll offset)
   * @returns The date corresponding to that position
   */
  private calculateDateFromPosition(x: number): Date {
    if (this.columns.length === 0) {
      return new Date();
    }

    const firstColumnDate = this.columns[0].date;
    let result: Date;

    switch (this.timescale) {
      case 'hour':
        // Convert pixels to hours (each column = 1 hour)
        const hoursOffset = Math.round(x / this.COLUMN_WIDTH_HOUR);
        result = new Date(firstColumnDate);
        result.setHours(result.getHours() + hoursOffset);
        break;
      case 'day':
        // Convert pixels to days (each column = 1 day)
        const daysOffset = Math.round(x / this.COLUMN_WIDTH_DAY);
        result = new Date(firstColumnDate);
        result.setDate(result.getDate() + daysOffset);
        break;
      case 'week':
        // Convert pixels to weeks, then to days
        const weeksOffset = x / this.COLUMN_WIDTH_WEEK;
        const daysFromWeeks = Math.round(weeksOffset * 7);
        result = new Date(firstColumnDate);
        result.setDate(result.getDate() + daysFromWeeks);
        break;
      case 'month':
        // Find which column the click is in
        const columnIndex = Math.floor(x / this.COLUMN_WIDTH_MONTH);
        const safeColumnIndex = Math.min(Math.max(0, columnIndex), this.columns.length - 1);
        result = new Date(this.columns[safeColumnIndex].date);
        // For month view, use the first day of the clicked month
        result.setDate(1);
        break;
      default:
        result = new Date(firstColumnDate);
    }

    // Normalize to start of day
    result.setHours(0, 0, 0, 0);
    return result;
  }

  onWorkOrderBarClick(event: MouseEvent, bar: WorkOrderBar): void {
    event.stopPropagation();
  }

  onActionsClick(event: MouseEvent, order: WorkOrderDocument): void {
    event.stopPropagation();
    const buttonRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.showActionsMenu = {
      orderId: order.docId,
      x: buttonRect.right - 100, // Align menu to the right of button
      y: buttonRect.bottom + 4 // Position menu below button with small gap
    };
  }

  onEdit(order: WorkOrderDocument): void {
    this.showActionsMenu = null;
    this.editWorkOrder.emit(order);
  }

  onDelete(order: WorkOrderDocument): void {
    this.showActionsMenu = null;
    if (confirm(`Are you sure you want to delete "${order.data.name}"?`)) {
      this.workOrderService.deleteWorkOrder(order.docId);
      setTimeout(() => this.scrollToCurrentDate(), 100);
    }
  }

  closeActionsMenu(): void {
    this.showActionsMenu = null;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'open':
        return 'rgba(242, 254, 255, 1)'; // Bar background color for open
      case 'in-progress':
        return 'rgba(237, 238, 255, 1)'; // Bar background color for in-progress
      case 'complete':
        return 'rgba(248, 255, 243, 1)'; // Bar background color for complete
      case 'blocked':
        return 'rgba(255, 252, 241, 1)'; // Bar background color for blocked
      default:
        return 'rgba(242, 254, 255, 1)'; // Default to open color
    }
  }

  getStatusBoxShadow(status: string): string {
    switch (status) {
      case 'open':
        return '0 0 0 1px rgba(206, 251, 255, 1)';
      case 'in-progress':
        return '0 0 0 1px rgba(222, 224, 255, 1)';
      case 'complete':
        return '0 0 0 1px rgba(209, 250, 179, 1)';
      case 'blocked':
        return '0 0 0 1px rgba(255, 245, 207, 1)';
      default:
        return '0 0 0 1px rgba(206, 251, 255, 1)'; // Default to open shadow
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

  getBarsForWorkCenter(workCenterId: string): WorkOrderBar[] {
    return this.workOrderBars.filter(bar => bar.order.data.workCenterId === workCenterId);
  }

  getOrderById(docId: string): WorkOrderDocument {
    return this.workOrders.find(o => o.docId === docId)!;
  }

  /**
   * Returns the appropriate label for the current date indicator based on timescale.
   * @returns "Current day", "Current week", or "Current month"
   */
  getCurrentDateLabel(): string {
    switch (this.timescale) {
      case 'hour':
        return 'Current hour';
      case 'day':
        return 'Current day';
      case 'week':
        return 'Current week';
      case 'month':
        return 'Current month';
      default:
        return 'Current month';
    }
  }

  isCurrentDateInAnyColumn(): boolean {
    return this.columns.some(column => this.isCurrentDateInColumn(column));
  }

  isCurrentDateInColumn(column: TimelineColumn): boolean {
    const colDate = new Date(column.date);
    const today = new Date(this.currentDate);

    switch (this.timescale) {
      case 'hour':
        // Check if current hour matches column hour (same date and hour)
        colDate.setMinutes(0, 0, 0);
        today.setMinutes(0, 0, 0);
        return colDate.getTime() === today.getTime();
      case 'day':
        colDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return colDate.getTime() === today.getTime();
      case 'week':
        // Calculate week start (Sunday) for the column date
        const colWeekStart = new Date(colDate);
        colWeekStart.setDate(colDate.getDate() - colDate.getDay());
        colWeekStart.setHours(0, 0, 0, 0);
        // Calculate week end (Saturday)
        const colWeekEnd = new Date(colWeekStart);
        colWeekEnd.setDate(colWeekStart.getDate() + 6);
        colWeekEnd.setHours(23, 59, 59, 999);
        // Check if today falls within this week
        return today >= colWeekStart && today <= colWeekEnd;
      case 'month':
        return colDate.getMonth() === today.getMonth() && 
               colDate.getFullYear() === today.getFullYear();
      default:
        return false;
    }
  }

  /**
   * Calculates the pixel position of the current day indicator within a column.
   * For day view, it's centered. For week/month views, it's positioned based on the day within the period.
   */
  getCurrentDateIndicatorPosition(column: TimelineColumn): number {
    // Always position at the start (left edge) of the column according to Sketch design
    return 0;
  }

  /**
   * Calculates the absolute pixel position of the current date line in the timeline rows.
   * This matches the position of the current date indicator in the header.
   * Positioned at the start (left edge) of the column according to Sketch design.
   */
  getCurrentDateLinePosition(column: TimelineColumn): number {
    if (!this.columns || this.columns.length === 0) return 0;
    
    const columnIndex = this.columns.findIndex(c => 
      c.date.getTime() === column.date.getTime()
    );
    if (columnIndex === -1) return 0;
    
    // Calculate the start position of the column by summing widths of previous columns
    let columnStart = 0;
    for (let i = 0; i < columnIndex; i++) {
      columnStart += this.columns[i].width;
    }
    
    // Position at the start (left edge) of the column
    return columnStart;
  }

  @Output() createWorkOrder = new EventEmitter<{ workCenterId: string; startDate: Date; endDate?: Date }>();
  @Output() editWorkOrder = new EventEmitter<WorkOrderDocument>();
}
