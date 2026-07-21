import { toast as sonnerToast, type ExternalToast } from "sonner";

const silent = (_message?: unknown, _options?: ExternalToast) => {};

/** Success/info toasts are silenced; errors still surface for failed actions. */
export const toast = {
  ...sonnerToast,
  success: silent,
  info: silent,
  message: silent,
  warning: silent,
};
