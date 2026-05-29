import { HttpErrorResponse } from '@angular/common/http';
import { NormalizedApiError } from '../models/predictive.models';

function extractBackendMessage(body: unknown): string | null {
  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  const messageCandidates = [record['message'], record['error'], record['detail']];
  const firstString = messageCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim());

  if (firstString) {
    return firstString as string;
  }

  const errors = record['errors'];
  if (Array.isArray(errors)) {
    const firstError = errors.find((candidate) => typeof candidate === 'string' && candidate.trim());
    if (typeof firstError === 'string') {
      return firstError;
    }
  }

  const fieldErrors = record['fieldErrors'];
  if (fieldErrors && typeof fieldErrors === 'object') {
    const entries = Object.entries(fieldErrors as Record<string, unknown>);
    const firstFieldError = entries.find(([, value]) => typeof value === 'string' && value.trim());
    if (firstFieldError) {
      const [field, message] = firstFieldError;
      return `${field}: ${message as string}`;
    }
  }

  return null;
}

export function normalizeApiError(
  error: unknown,
  fallbackMessage: string
): NormalizedApiError {
  if (error instanceof HttpErrorResponse) {
    const backendMessage = extractBackendMessage(error.error);

    return {
      statusCode: error.status,
      backendMessage,
      message: backendMessage ?? fallbackMessage,
      details: error.error,
    };
  }

  if (error instanceof Error) {
    return {
      statusCode: 0,
      backendMessage: error.message,
      message: error.message || fallbackMessage,
      details: error,
    };
  }

  return {
    statusCode: 0,
    backendMessage: null,
    message: fallbackMessage,
    details: error,
  };
}
