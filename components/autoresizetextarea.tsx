import { useRef } from "react";

const AutoResizeTextarea = () => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleInput = () => {
    const textarea = ref.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  };

  return (
    <textarea
      ref={ref}
      onInput={handleInput}
        className="flex-shrink-0 min-w-32 w-full bg-transparent scrollbar-hide resize-none overflow-hidden
             text-center"
      rows={1}
    />
  );
};

export default AutoResizeTextarea;
