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
  return (firstString as string | undefined) ?? null;
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
