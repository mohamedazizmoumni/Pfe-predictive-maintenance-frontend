import { Directive, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

// Animates the host element's text from its previous numeric value to the
// new one. Takes a raw number + formatter (rather than a pre-formatted
// string) so currency/percent/day-suffix formatting stays correct mid-tween.
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('appCountUp') target = 0;
  @Input() countUpFormat: (value: number) => string = (v) => Math.round(v).toLocaleString();
  @Input() countUpDuration = 700;

  private frameId: number | null = null;
  private hasAnimatedOnce = false;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['target']) {
      return;
    }
    const from = this.hasAnimatedOnce ? (changes['target'].previousValue ?? 0) : 0;
    this.animate(from, this.target);
    this.hasAnimatedOnce = true;
  }

  ngOnDestroy(): void {
    if (this.frameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.frameId);
    }
  }

  private animate(from: number, to: number): void {
    if (typeof requestAnimationFrame === 'undefined') {
      this.el.nativeElement.textContent = this.countUpFormat(to);
      return;
    }

    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / this.countUpDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.el.nativeElement.textContent = this.countUpFormat(from + (to - from) * eased);
      if (progress < 1) {
        this.frameId = requestAnimationFrame(step);
      }
    };
    this.frameId = requestAnimationFrame(step);
  }
}
