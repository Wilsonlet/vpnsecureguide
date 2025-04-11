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
        "relative inline-block w-[64px] h-[34px]",
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
          checked 
            ? "bg-gradient-to-r from-blue-600 to-cyan-400 shadow-lg shadow-blue-500/30" 
            : "bg-gray-800 border border-gray-700",
          disabled && "cursor-not-allowed"
        )}
      >
        {/* Track lines for futuristic look */}
        <span className={cn(
          "absolute inset-[3px] rounded-full overflow-hidden",
          checked ? "opacity-30" : "opacity-0",
          "transition-opacity duration-300"
        )}>
          <span className="absolute inset-0 bg-grid-pattern bg-black/20"></span>
        </span>
        
        {/* Glowing dot when active */}
        {checked && (
          <span className="absolute h-[4px] w-[4px] right-[14px] top-1/2 -translate-y-1/2 bg-white rounded-full animate-pulse"></span>
        )}
        
        {/* Knob with futuristic styling */}
        <span 
          className={cn(
            "absolute h-[26px] w-[26px] left-[4px] bottom-[4px] rounded-full transition-all duration-300 flex items-center justify-center",
            checked 
              ? "transform translate-x-[30px] bg-white shadow-md shadow-blue-500/20" 
              : "bg-gray-200",
          )}
        >
          {/* Center dot */}
          <span className={cn(
            "h-[10px] w-[10px] rounded-full transition-colors duration-300",
            checked ? "bg-blue-500" : "bg-gray-400"
          )}></span>
        </span>
      </span>
    </label>
  );
}
