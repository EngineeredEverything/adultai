import { CheckCircle } from "lucide-react";

interface FormSuccessProps {
  message?: string;
};

/**
 * Renders a success message component for a form.
 *
 * @param {FormSuccessProps} props - The props for the FormSuccess component.
 * @param {string} [props.message] - The success message to display.
 * @returns {React.ReactElement | null} - The FormSuccess component, or null if no message is provided.
 */
export const FormSuccess = ({
  message,
}: FormSuccessProps) => {
  if (!message) return null;

  return (
    <div className="bg-emerald-500/15 p-3 rounded-md flex items-center gap-x-2 text-sm text-emerald-500">
      <CheckCircle className="h-4 w-4" />
      <p>{message}</p>
    </div>
  );
};
