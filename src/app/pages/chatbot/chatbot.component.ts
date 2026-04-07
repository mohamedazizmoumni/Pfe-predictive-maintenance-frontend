import { Component, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService } from '../../core/services/chatbot.service';
import { ChatbotResponse } from '../../core/models/sentinel.models';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  authorized?: boolean;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.scss',
})
export class ChatbotComponent {
  messages: ChatMessage[] = [];
  question = '';
  isSubmitting = false;
  errorMessage: string | null = null;
  private idCounter = 0;

  // Resizable chat height
  chatHeight: number = 620;           // Default height in pixels
  private minHeight = 420;
  private maxHeight = 920;
  private isResizing = false;
  private startY = 0;
  private startHeight = 0;

  @ViewChild('chatShell') chatShell!: ElementRef;

  constructor(private chatbotService: ChatbotService) {}

  onSubmit(): void {
    this.errorMessage = null;

    const trimmed = this.question.trim();
    if (!trimmed) {
      this.errorMessage = 'Please enter a question.';
      return;
    }

    if (trimmed.length > 1000) {
      this.errorMessage = 'Question must be 1000 characters or fewer.';
      return;
    }

    this.appendMessage('user', trimmed);
    this.question = '';
    this.isSubmitting = true;

    this.chatbotService
      .ask({ question: trimmed })
      .subscribe({
        next: (response: ChatbotResponse) => {
          const authorized = response.authorized !== false && response.answer !== 'NOT AUTHORIZED';
          this.appendMessage('assistant', response.answer, authorized);
          this.isSubmitting = false;
        },
        error: (err: any) => {
          this.errorMessage = err.message || 'Something went wrong while contacting the assistant.';
          this.isSubmitting = false;
        },
      });
  }

  onKeydownEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
      event.preventDefault();
      if (!this.isSubmitting && this.question.trim()) {
        this.onSubmit();
      }
    }
  }

  clearChat(): void {
    this.messages = [];
    this.errorMessage = null;
  }

  // Resize functionality
  startResizing(event: MouseEvent): void {
    this.isResizing = true;
    this.startY = event.clientY;
    this.startHeight = this.chatHeight;
    event.preventDefault();
    document.body.style.cursor = 'ns-resize';
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;

    const deltaY = this.startY - event.clientY;
    let newHeight = this.startHeight + deltaY;

    newHeight = Math.max(this.minHeight, Math.min(this.maxHeight, newHeight));
    this.chatHeight = newHeight;
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (this.isResizing) {
      this.isResizing = false;
      document.body.style.cursor = 'default';
    }
  }

  resetChatSize(): void {
    this.chatHeight = 620;
  }

  trackById(_: number, item: ChatMessage): number {
    return item.id;
  }

  private appendMessage(role: 'user' | 'assistant', content: string, authorized?: boolean): void {
    this.idCounter += 1;
    this.messages = [
      ...this.messages,
      {
        id: this.idCounter,
        role,
        content,
        authorized,
      },
    ];
  }
}