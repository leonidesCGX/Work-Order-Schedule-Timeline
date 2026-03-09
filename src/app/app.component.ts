import { Component, ViewChild } from '@angular/core';
import { TimelineComponent } from './timeline/timeline.component';
import { WorkOrderPanelComponent } from './work-order-panel/work-order-panel.component';
import { WorkOrderDocument } from './models/work-order.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TimelineComponent, WorkOrderPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  @ViewChild(TimelineComponent) timeline!: TimelineComponent;

  panelOpen = false;
  panelMode: 'create' | 'edit' = 'create';
  selectedWorkCenterId = '';
  selectedStartDate = new Date();
  selectedEndDate?: Date;
  selectedWorkOrder: WorkOrderDocument | null = null;

  onCreateWorkOrder(event: { workCenterId: string; startDate: Date; endDate?: Date }): void {
    this.selectedWorkCenterId = event.workCenterId;
    this.selectedStartDate = event.startDate;
    this.selectedEndDate = event.endDate;
    this.panelMode = 'create';
    this.selectedWorkOrder = null;
    this.panelOpen = true;
  }

  onEditWorkOrder(order: WorkOrderDocument): void {
    this.selectedWorkOrder = order;
    this.selectedWorkCenterId = order.data.workCenterId;
    this.selectedStartDate = new Date(order.data.startDate);
    this.panelMode = 'edit';
    this.panelOpen = true;
  }

  onPanelClose(): void {
    this.panelOpen = false;
    this.selectedWorkOrder = null;
  }

  onPanelSave(): void {
    this.panelOpen = false;
    this.selectedWorkOrder = null;
    // Recenter timeline on current day/week/month/hour after create or edit
    setTimeout(() => this.timeline?.scrollToCurrentDate(), 150);
  }
}
