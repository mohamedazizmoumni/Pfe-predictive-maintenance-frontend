import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MachineContextService {
  selectedMachine: any = null;

  setMachine(machine: any): void {
    this.selectedMachine = machine;
  }

  getMachineId(): number | null {
    return this.selectedMachine?.id ?? null;
  }

  getMachine(): any {
    return this.selectedMachine;
  }
}