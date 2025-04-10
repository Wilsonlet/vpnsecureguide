import React from 'react';
import { cn } from '@/lib/utils';

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export default function ToggleSwitch({ checked, onChange, disabled = false, className }: ToggleSwitchProps) {
  return (
    <label 
      className={cn(
        "relative inline-block w-[60px] h-[34px]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input
        type="checkbox"
        className="opacity-0 w-0 h-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span
        className={cn(
          "absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300",
          checked ? "bg-teal-600" : "bg-gray-700",
          disabled && "cursor-not-allowed"
        )}
      >
        <span 
          className={cn(
            "absolute h-[26px] w-[26px] left-[4px] bottom-[4px] bg-white rounded-full transition-all duration-300",
            checked && "transform translate-x-[26px]"
          )}
        />
      </span>
    </label>
  );
}
