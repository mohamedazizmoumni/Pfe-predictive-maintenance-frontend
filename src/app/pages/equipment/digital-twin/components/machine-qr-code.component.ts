import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as QRCode from 'qrcode';

/**
 * Encodes a direct URL to this machine's detail page — scanning it with a
 * phone camera opens the page directly, no dedicated backend "scan"
 * endpoint needed.
 */
@Component({
  selector: 'app-machine-qr-code',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="qr">
      <img *ngIf="dataUrl" [src]="dataUrl" alt="QR code linking to this machine" />
      <p class="hint">Scan to open this machine's page on a phone.</p>
      <button type="button" class="download" *ngIf="dataUrl" (click)="download()">⬇ Download PNG</button>
    </div>
  `,
  styles: [`
    .qr { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .qr img { width: 160px; height: 160px; border-radius: 10px; background: #fff; padding: 8px; }
    .hint { margin: 0; font-size: 11px; color: var(--text-tertiary); text-align: center; }
    .download {
      padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-mid); background: transparent;
      color: var(--text-primary); font-size: 11.5px; font-weight: 600; cursor: pointer;
    }
  `],
})
export class MachineQrCodeComponent implements OnChanges {
  @Input() machineId!: number;
  @Input() serialNumber?: string;

  dataUrl: string | null = null;

  ngOnChanges(): void {
    if (!this.machineId) return;
    const url = `${window.location.origin}/equipment/${this.machineId}/visual`;
    QRCode.toDataURL(url, { width: 320, margin: 1 })
      .then((dataUrl) => { this.dataUrl = dataUrl; })
      .catch(() => { this.dataUrl = null; });
  }

  download(): void {
    if (!this.dataUrl) return;
    const link = document.createElement('a');
    link.href = this.dataUrl;
    link.download = `machine-qr-${this.serialNumber || this.machineId}.png`;
    link.click();
  }
}
