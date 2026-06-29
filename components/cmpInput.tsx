import { Input } from "@heroui/input"

interface Props {
    label?: string;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isReadOnly?: boolean;
}

export const CmpInput = ({label, placeholder, value, onChange, isReadOnly}: Props) => {
    return (
        <Input
          labelPlacement="inside"
          label={label ? <div className=" font-bold text-md">{label}</div> : undefined}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          isReadOnly={isReadOnly}
          classNames={{
            inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl"
          }}
        />
    )
}