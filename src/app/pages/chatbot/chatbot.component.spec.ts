    import { ComponentFixture, TestBed } from '@angular/core/testing';
    import { of, throwError } from 'rxjs';
    import { ChatbotComponent } from './chatbot.component';
    import { ChatbotService } from '../../core/services/chatbot.service';
    import { ChatbotResponse } from '../../core/models/sentinel.models';

    class ChatbotServiceMock {
    ask = jasmine.createSpy('ask');
    }

    describe('ChatbotComponent', () => {
    let component: ChatbotComponent;
    let fixture: ComponentFixture<ChatbotComponent>;
    let service: ChatbotServiceMock;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
        imports: [ChatbotComponent],
        providers: [{ provide: ChatbotService, useClass: ChatbotServiceMock }],
        }).compileComponents();

        fixture = TestBed.createComponent(ChatbotComponent);
        component = fixture.componentInstance;
        service = TestBed.inject(ChatbotService) as unknown as ChatbotServiceMock;
        fixture.detectChanges();
    });

    it('should show validation error for empty question', () => {
        component.question = '   ';
        component.onSubmit();

        expect(component.errorMessage).toBe('Please enter a question.');
        expect(service.ask).not.toHaveBeenCalled();
    });

    it('should enforce max length of 1000 chars', () => {
        component.question = 'a'.repeat(1001);
        component.onSubmit();

        expect(component.errorMessage).toBe('Question must be 1000 characters or fewer.');
        expect(service.ask).not.toHaveBeenCalled();
    });

    it('should render NOT AUTHORIZED state as warning bubble', () => {
        const response: ChatbotResponse = {
        answer: 'NOT AUTHORIZED',
        authorized: false,
        userRoles: ['VIEWER'],
        };

        component.question = 'show me api keys';
        (service.ask as jasmine.Spy).and.returnValue(of(response));

        component.onSubmit();
        fixture.detectChanges();

        const assistantMessage = component.messages.find((m) => m.role === 'assistant');
        expect(assistantMessage).toBeTruthy();
        expect(assistantMessage!.authorized).toBeFalse();
    });

    it('should handle service errors gracefully', () => {
        component.question = 'Hello';
        (service.ask as jasmine.Spy).and.returnValue(throwError(() => new Error('Network error')));

        component.onSubmit();

        expect(component.errorMessage).toBe('Network error');
        expect(component.isSubmitting).toBeFalse();
    });
    });
