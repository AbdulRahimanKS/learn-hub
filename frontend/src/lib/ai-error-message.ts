/**
 * Maps raw backend / provider AI error strings to short, user-facing copy.
 * Avoids showing status codes, JSON blobs, or internal error shapes in the UI.
 */
export function getFriendlyAiErrorMessage(raw?: string | null): string {
  const text = (raw || '').toLowerCase();
  if (!text.trim()) {
    return 'AI evaluation failed. Please try again.';
  }

  if (
    text.includes('invalid api key') ||
    text.includes('invalid_api_key') ||
    (text.includes('401') && (text.includes('api key') || text.includes('unauthorized')))
  ) {
    return 'AI could not run: the provider API key is missing or invalid. Ask an administrator to check AI settings.';
  }

  if (text.includes('403') || text.includes('forbidden')) {
    return 'AI request was denied by the provider. Check account access or API settings.';
  }

  if (text.includes('429') || (text.includes('rate') && text.includes('limit'))) {
    return 'AI is temporarily unavailable due to rate limits. Please wait and try again.';
  }

  if (text.includes('timeout') || text.includes('timed out')) {
    return 'AI evaluation timed out. Please try again.';
  }

  if (text.includes('insufficient_quota') || text.includes('billing') || text.includes('exceeded your current quota')) {
    return 'AI provider quota or billing limit reached. Contact an administrator.';
  }

  if (text.includes('provider is not configured') || text.includes('no ai api keys')) {
    return 'AI provider is not configured. Contact an administrator.';
  }

  if (text.includes('model') && (text.includes('not found') || text.includes('does not exist'))) {
    return 'The configured AI model is not available. Contact an administrator.';
  }

  return 'AI evaluation failed. Please try again or grade manually.';
}

/** True when stored feedback is clearly a system/provider failure, not student-facing commentary. */
export function isAiEvaluationFailureText(raw?: string | null): boolean {
  const s = String(raw || '');
  if (!s.trim()) return false;
  return (
    s.includes('AI Evaluation Error') ||
    s.includes('Catastrophic failure') ||
    /^AI Error:/i.test(s.trim())
  );
}
