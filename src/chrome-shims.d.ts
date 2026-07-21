// chrome-types is generated from Chrome's formal API schema, which does not
// include `runtime.lastError`; declare it here so callback error checks type.
declare namespace chrome.runtime {
  const lastError: { message?: string } | undefined;
}
