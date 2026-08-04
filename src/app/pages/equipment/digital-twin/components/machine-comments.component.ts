import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommentService } from '../../../../core/services/comment.service';
import { CommentResponse } from '../../../../core/models/sentinel.models';

@Component({
  selector: 'app-machine-comments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="comments">
      <div class="comment" *ngFor="let comment of comments">
        <div class="comment__meta">
          <strong>{{ comment.authorUsername }}</strong>
          <span>{{ comment.createdAt | date:'short' }}</span>
        </div>
        <p>{{ comment.body }}</p>
      </div>
      <p class="empty" *ngIf="!isLoading && comments.length === 0">No comments yet.</p>

      <div class="composer">
        <textarea [(ngModel)]="draft" placeholder="Add a comment…"></textarea>
        <button type="button" [disabled]="!draft.trim() || isSaving" (click)="submit()">
          {{ isSaving ? 'Posting…' : 'Post' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .comments { display: flex; flex-direction: column; gap: 10px; }
    .comment { background: rgba(148,163,184,0.08); border-radius: 10px; padding: 8px 10px; }
    .comment__meta { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--text-tertiary); margin-bottom: 3px; }
    .comment__meta strong { color: var(--text-primary); }
    .comment p { margin: 0; font-size: 12px; color: var(--text-secondary); }
    .empty { font-size: 12px; color: var(--text-tertiary); margin: 0; }
    .composer { display: flex; gap: 8px; align-items: flex-end; margin-top: 4px; }
    .composer textarea {
      flex: 1; min-height: 40px; resize: vertical; padding: 6px 8px; border-radius: 8px;
      border: 1px solid var(--border-mid); background: transparent; color: var(--text-primary); font-family: inherit; font-size: 12px;
    }
    .composer button {
      padding: 7px 12px; border-radius: 8px; border: none; background: var(--accent, #4f7cff);
      color: #fff; font-weight: 600; font-size: 12px; cursor: pointer;
    }
    .composer button:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
})
export class MachineCommentsComponent implements OnChanges {
  /** Kept as the historical input name; despite the name it's the target entity's id (machine or maintenance). */
  @Input() machineId!: number;
  @Input() entityType: 'MACHINE' | 'MAINTENANCE' = 'MACHINE';

  comments: CommentResponse[] = [];
  isLoading = true;
  draft = '';
  isSaving = false;

  constructor(private commentService: CommentService) {}

  ngOnChanges(): void {
    if (this.machineId) this.load();
  }

  private load(): void {
    this.isLoading = true;
    this.commentService.list(this.entityType, this.machineId).subscribe({
      next: (comments) => { this.comments = comments; this.isLoading = false; },
      error: () => { this.isLoading = false; },
    });
  }

  submit(): void {
    if (!this.draft.trim()) return;
    this.isSaving = true;
    this.commentService.add({ entityType: this.entityType, entityId: this.machineId, body: this.draft }).subscribe({
      next: (comment) => { this.comments = [...this.comments, comment]; this.draft = ''; this.isSaving = false; },
      error: () => { this.isSaving = false; },
    });
  }
}
