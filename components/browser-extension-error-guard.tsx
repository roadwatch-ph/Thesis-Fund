"use client";

import { useEffect } from "react";

const extensionConnectionError = "Could not establish connection. Receiving end does not exist.";

function isBrowserExtensionConnectionError(reason: unknown) {
  if (reason instanceof Error) {
    return reason.message.includes(extensionConnectionError);
  }

  return typeof reason === "string" && reason.includes(extensionConnectionError);
}

export function BrowserExtensionErrorGuard() {
  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (!isBrowserExtensionConnectionError(event.reason)) return;

      event.preventDefault();
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  return null;
}
