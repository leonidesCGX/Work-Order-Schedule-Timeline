import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WorkCenterDocument } from '../models/work-center.model';
import { WorkOrderDocument, WorkOrderStatus } from '../models/work-order.model';

@Injectable({
  providedIn: 'root'
})
export class WorkOrderService {
  private workCentersSubject = new BehaviorSubject<WorkCenterDocument[]>(this.getInitialWorkCenters());
  private workOrdersSubject = new BehaviorSubject<WorkOrderDocument[]>(this.getInitialWorkOrders());

  workCenters$: Observable<WorkCenterDocument[]> = this.workCentersSubject.asObservable();
  workOrders$: Observable<WorkOrderDocument[]> = this.workOrdersSubject.asObservable();

  constructor() {
    // Load from localStorage if available
    this.loadFromLocalStorage();
  }

  getWorkCenters(): WorkCenterDocument[] {
    return this.workCentersSubject.value;
  }

  getWorkOrders(): WorkOrderDocument[] {
    return this.workOrdersSubject.value;
  }

  getWorkOrderById(docId: string): WorkOrderDocument | undefined {
    return this.workOrdersSubject.value.find(wo => wo.docId === docId);
  }

  getWorkOrdersByWorkCenter(workCenterId: string): WorkOrderDocument[] {
    return this.workOrdersSubject.value.filter(wo => wo.data.workCenterId === workCenterId);
  }

  createWorkOrder(workOrder: Omit<WorkOrderDocument, 'docId'>): WorkOrderDocument {
    const newWorkOrder: WorkOrderDocument = {
      ...workOrder,
      docId: this.generateId()
    };
    const currentOrders = this.workOrdersSubject.value;
    this.workOrdersSubject.next([...currentOrders, newWorkOrder]);
    this.saveToLocalStorage();
    return newWorkOrder;
  }

  updateWorkOrder(docId: string, updates: Partial<WorkOrderDocument['data']>): void {
    const currentOrders = this.workOrdersSubject.value;
    const updatedOrders = currentOrders.map(wo => 
      wo.docId === docId 
        ? { ...wo, data: { ...wo.data, ...updates } }
        : wo
    );
    this.workOrdersSubject.next(updatedOrders);
    this.saveToLocalStorage();
  }

  deleteWorkOrder(docId: string): void {
    const currentOrders = this.workOrdersSubject.value;
    this.workOrdersSubject.next(currentOrders.filter(wo => wo.docId !== docId));
    this.saveToLocalStorage();
  }

  /**
   * Checks if a work order date range overlaps with existing orders on the same work center.
   * Two date ranges overlap if: start1 <= end2 AND end1 >= start2
   * 
   * @param workCenterId - The work center to check for overlaps
   * @param startDate - Start date of the new/edited order (ISO format)
   * @param endDate - End date of the new/edited order (ISO format)
   * @param excludeDocId - Optional: exclude this order ID from overlap check (useful when editing)
   * @returns true if overlap detected, false otherwise
   */
  checkOverlap(
    workCenterId: string,
    startDate: string,
    endDate: string,
    excludeDocId?: string
  ): boolean {
    // Get all orders for this work center, excluding the one being edited
    const orders = this.getWorkOrdersByWorkCenter(workCenterId)
      .filter(wo => !excludeDocId || wo.docId !== excludeDocId);
    
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if any existing order overlaps with the new date range
    // Overlap occurs when: newStart <= existingEnd AND newEnd >= existingStart
    return orders.some(order => {
      const orderStart = new Date(order.data.startDate);
      const orderEnd = new Date(order.data.endDate);
      
      return (start <= orderEnd && end >= orderStart);
    });
  }

  private generateId(): string {
    return `wo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getInitialWorkCenters(): WorkCenterDocument[] {
    return [
      { docId: 'wc_1', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
      { docId: 'wc_2', docType: 'workCenter', data: { name: 'CNC Machine 1' } },
      { docId: 'wc_3', docType: 'workCenter', data: { name: 'Assembly Station' } },
      { docId: 'wc_4', docType: 'workCenter', data: { name: 'Quality Control' } },
      { docId: 'wc_5', docType: 'workCenter', data: { name: 'Packaging Line' } }
    ];
  }

  private getInitialWorkOrders(): WorkOrderDocument[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Helper to add days
    const addDays = (date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    // Helper to add months
    const addMonths = (date: Date, months: number) => {
      const result = new Date(date);
      result.setMonth(result.getMonth() + months);
      return result;
    };

    // Create work orders centered around today with varied date ranges
    // Ensure all 4 status types are represented
    return [
      {
        docId: 'wo_1',
        docType: 'workOrder',
        data: {
          name: 'Production Batch #1247',
          workCenterId: 'wc_1',
          status: 'complete',
          startDate: formatDate(addDays(today, -14)),
          endDate: formatDate(addDays(today, -7))
        }
      },
      {
        docId: 'wo_2',
        docType: 'workOrder',
        data: {
          name: 'Custom Machining Order',
          workCenterId: 'wc_2',
          status: 'in-progress',
          startDate: formatDate(addDays(today, -5)),
          endDate: formatDate(addDays(today, 12))
        }
      },
      {
        docId: 'wo_3',
        docType: 'workOrder',
        data: {
          name: 'Assembly Project Alpha',
          workCenterId: 'wc_3',
          status: 'in-progress',
          startDate: formatDate(addDays(today, 2)),
          endDate: formatDate(addDays(today, 25))
        }
      },
      {
        docId: 'wo_4',
        docType: 'workOrder',
        data: {
          name: 'Component Assembly Run',
          workCenterId: 'wc_3',
          status: 'open',
          startDate: formatDate(addDays(today, 30)),
          endDate: formatDate(addDays(today, 45))
        }
      },
      {
        docId: 'wo_5',
        docType: 'workOrder',
        data: {
          name: 'QC Inspection Batch',
          workCenterId: 'wc_4',
          status: 'blocked',
          startDate: formatDate(addDays(today, 8)),
          endDate: formatDate(addDays(today, 18))
        }
      },
      {
        docId: 'wo_6',
        docType: 'workOrder',
        data: {
          name: 'Packaging Order #892',
          workCenterId: 'wc_5',
          status: 'open',
          startDate: formatDate(addDays(today, 15)),
          endDate: formatDate(addDays(today, 28))
        }
      },
      {
        docId: 'wo_7',
        docType: 'workOrder',
        data: {
          name: 'Extrusion Run #456',
          workCenterId: 'wc_1',
          status: 'in-progress',
          startDate: formatDate(addDays(today, -3)),
          endDate: formatDate(addDays(today, 10))
        }
      },
      {
        docId: 'wo_8',
        docType: 'workOrder',
        data: {
          name: 'Final Quality Check',
          workCenterId: 'wc_4',
          status: 'complete',
          startDate: formatDate(addDays(today, -20)),
          endDate: formatDate(addDays(today, -12))
        }
      }
    ];
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('workOrders', JSON.stringify(this.workOrdersSubject.value));
      localStorage.setItem('workCenters', JSON.stringify(this.workCentersSubject.value));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  private loadFromLocalStorage(): void {
    try {
      const savedOrders = localStorage.getItem('workOrders');
      const savedCenters = localStorage.getItem('workCenters');
      
      if (savedOrders) {
        const orders = JSON.parse(savedOrders);
        if (Array.isArray(orders) && orders.length > 0) {
          this.workOrdersSubject.next(orders);
        }
      }
      
      if (savedCenters) {
        const centers = JSON.parse(savedCenters);
        if (Array.isArray(centers) && centers.length > 0) {
          this.workCentersSubject.next(centers);
        }
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
  }
}
