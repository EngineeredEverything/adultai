import { TriangleAlert } from "lucide-react";

interface FormErrorProps {
  message?: string;
};

/**
 * Renders a form error message component.
 *
 * @param {FormErrorProps} props - The props for the form error component.
 * @param {string} [props.message] - The error message to display.
 * @returns {React.ReactElement | null} - The form error component, or null if no message is provided.
 */
export const FormError = ({
  message,
}: FormErrorProps) => {
  if (!message) return null;

  return (
    <div className="bg-destructive/15 p-3 rounded-md flex items-center gap-x-2 text-sm text-destructive">
      <TriangleAlert className="h-4 w-4" />
      <p>{message}</p>
    </div>
  );
};
