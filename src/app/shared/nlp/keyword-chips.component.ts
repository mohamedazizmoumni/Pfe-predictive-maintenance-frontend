import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-keyword-chips',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './keyword-chips.component.html',
  styleUrls: ['./keyword-chips.component.scss'],
})
export class KeywordChipsComponent {
  @Input() keywords: string[] = [];
}
