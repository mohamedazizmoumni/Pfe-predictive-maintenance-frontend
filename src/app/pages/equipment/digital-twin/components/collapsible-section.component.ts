import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-collapsible-section',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <section class="collapsible" [class.collapsible--open]="open">
      <button type="button" class="collapsible__head" (click)="open = !open" [attr.aria-expanded]="open">
        <span class="collapsible__icon"><lucide-icon [name]="icon" [size]="14"></lucide-icon></span>
        <span class="collapsible__title">{{ title }}</span>
        <span class="collapsible__badge" *ngIf="badge">{{ badge }}</span>
        <lucide-icon name="chevron-down" [size]="15" class="collapsible__chevron"></lucide-icon>
      </button>
      <div class="collapsible__body" *ngIf="open">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .collapsible {
      border: 1px solid var(--border-mid);
      border-radius: 14px;
      background: var(--bg-elevated);
      overflow: hidden;
    }

    .collapsible__head {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 12px 14px;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
    }

    .collapsible__icon {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(148, 163, 184, 0.1);
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .collapsible__title {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--text-primary);
      flex: 1;
    }

    .collapsible__badge {
      font-size: 9.5px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(156, 163, 175, 0.16);
      color: var(--text-secondary);
    }

    .collapsible__chevron {
      color: var(--text-tertiary);
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }

    .collapsible--open .collapsible__chevron {
      transform: rotate(180deg);
    }

    .collapsible__body {
      padding: 0 14px 14px;
      animation: collapsible-open 0.2s ease;
    }

    @keyframes collapsible-open {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `],
})
export class CollapsibleSectionComponent {
  @Input() title = '';
  @Input() icon = 'info';
  @Input() badge: string | null = null;
  @Input() open = false;
}
