/* eslint-disable @typescript-eslint/no-explicit-any */
interface MessageDeliveryStatusUI {
  icon: string;
  color: string;
}

interface PDialogProps {
  title?: string;
  width?: string | number;
  wrapperCssClass?: string;
  wrapperCssStyle?: Record<string, string>;
  cssClass?: string;
  cssStyle?: Record<string, string>;
  confirmButton?: boolean;
  cancelButton?: boolean;
  onConfirm?: (data: any) => void;
  onCancel?: (data: any) => void;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  confirmButtonBackground?: string;
  cancelButtonBackground?: string;
  overlay?: boolean;
  solo?: boolean;
  lockScroll?: boolean;
  closeOnClickOverlay?: boolean;
}
