import { Select, SelectItem } from "@heroui/select";

export interface Option {
  value: string;
  label: string;
}

interface Props {
  data: Option[];
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export const CmpSelect = ({
  data,
  label,
  placeholder,
  value,
  onChange,
}: Props) => {
  return (
    <Select
      label={
        label ? <div className=" font-bold text-md">{label}</div> : undefined
      }
      placeholder={placeholder}
      value={value}
      onSelectionChange={(value) => onChange(value.currentKey as string)}
      classNames={{
        trigger:
          "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl ",
      }}
    >
      {data.map((animal) => (
        <SelectItem key={animal.value}>{animal.label}</SelectItem>
      ))}
    </Select>
  );
};
